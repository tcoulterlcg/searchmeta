import type { InValue } from "@libsql/client/web";
import { getNewArchive, getOldArchive, markArchiveMoved, newArchiveConfigured, oldArchiveConfigured } from "./archive";

/**
 * One-time copy of the sold archive from the old Turso database (work-login account) into the new
 * one (Trevor's personal account). Runs a chunk at a time inside the every-minute archive cron.
 *
 * Rows keep their ids, so the copy can stop and resume anywhere. New sales keep going to the old
 * database until the copy has caught up; then the "move" job is marked done and every instance
 * switches to the new database (lib/archive.ts). Small job rows (Goldin/Fanatics progress, etc.)
 * are copied at the end so the scrapers carry on where they were.
 *
 * Turso's free plan allows 10M row writes a month and each copied sale costs a few (the row, its
 * unique index, the full-text index), so the copy stops for the month at MOVE_MONTHLY_ROWS sales.
 */

export interface MoveState {
  copiedTo: number; // highest old id copied
  copied: number; // rows read and sent (duplicates included)
  oldMax: number;
  month: string; // YYYY-MM the monthly count belongs to
  monthCopied: number;
  startedAt: string;
  updatedAt: string;
  done: boolean;
  doneAt?: string;
  pausedForMonth?: boolean;
  lastError?: string;
}

const MONTHLY_ROWS = Number(process.env.MOVE_MONTHLY_ROWS ?? 2_000_000);
const READ_BATCH = 2000;
const ROWS_PER_INSERT = 100;
const COLS = ["id", "source", "external_id", "title", "url", "image_url", "price", "sale_type", "sold_at", "first_seen_at"];

const thisMonth = () => new Date().toISOString().slice(0, 7);

export async function readMoveState(): Promise<MoveState | null> {
  if (!newArchiveConfigured()) return null;
  const db = await getNewArchive();
  const r = await db.execute({ sql: "SELECT state FROM jobs WHERE name = 'move'", args: [] });
  return r.rows[0]?.state ? (JSON.parse(String(r.rows[0].state)) as MoveState) : null;
}

async function writeMoveState(st: MoveState) {
  const db = await getNewArchive();
  st.updatedAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO jobs (name, state, updated_at) VALUES ('move', ?, ?)
          ON CONFLICT(name) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
    args: [JSON.stringify(st), st.updatedAt],
  });
}

/** Copies job progress rows (not 'move') so the scrapers resume from the same place. */
async function copyJobs() {
  const from = await getOldArchive();
  const to = await getNewArchive();
  const r = await from.execute("SELECT name, state, updated_at FROM jobs WHERE name <> 'move'");
  if (!r.rows.length) return;
  await to.batch(
    r.rows.map((j) => ({
      sql: `INSERT INTO jobs (name, state, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
      args: [j.name as InValue, j.state as InValue, j.updated_at as InValue],
    })),
    "write",
  );
}

/**
 * Copies as many rows as fit before the deadline. Returns the state, or null when there is
 * nothing to move (no new database configured, or no old one left).
 */
export async function moveStep(deadline: number): Promise<MoveState | null> {
  if (!newArchiveConfigured() || !oldArchiveConfigured()) return null;
  const now = new Date().toISOString();
  let st: MoveState = (await readMoveState()) ?? {
    copiedTo: 0,
    copied: 0,
    oldMax: 0,
    month: thisMonth(),
    monthCopied: 0,
    startedAt: now,
    updatedAt: now,
    done: false,
  };
  if (st.done) {
    markArchiveMoved();
    return st;
  }
  if (st.month !== thisMonth()) st = { ...st, month: thisMonth(), monthCopied: 0, pausedForMonth: false };

  const from = await getOldArchive();
  const to = await getNewArchive();
  try {
    const top = await from.execute("SELECT MAX(id) AS n FROM sales");
    st.oldMax = Number(top.rows[0]?.n ?? 0);

    while (Date.now() < deadline) {
      if (st.monthCopied >= MONTHLY_ROWS) {
        st.pausedForMonth = true;
        break;
      }
      const limit = Math.min(READ_BATCH, MONTHLY_ROWS - st.monthCopied);
      const res = await from.execute({
        sql: `SELECT ${COLS.join(", ")} FROM sales WHERE id > ? ORDER BY id LIMIT ?`,
        args: [st.copiedTo, limit],
      });
      if (!res.rows.length) {
        // Caught up: copy job progress, then switch everything to the new database.
        await copyJobs();
        st.done = true;
        st.doneAt = new Date().toISOString();
        markArchiveMoved();
        break;
      }
      const stmts = [];
      for (let i = 0; i < res.rows.length; i += ROWS_PER_INSERT) {
        const chunk = res.rows.slice(i, i + ROWS_PER_INSERT);
        stmts.push({
          sql: `INSERT OR IGNORE INTO sales (${COLS.join(", ")}) VALUES ${chunk
            .map(() => `(${COLS.map(() => "?").join(", ")})`)
            .join(", ")}`,
          args: chunk.flatMap((row) => COLS.map((c) => (row[c] ?? null) as InValue)),
        });
      }
      await to.batch(stmts, "write");
      st.copiedTo = Number(res.rows[res.rows.length - 1].id);
      st.copied += res.rows.length;
      st.monthCopied += res.rows.length;
    }
    st.lastError = undefined;
  } catch (e) {
    st.lastError = e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
  } finally {
    await writeMoveState(st);
  }
  return st;
}
