import { createClient, type Client, type InStatement } from "@libsql/client/web";
import { parseQuery, type Clause } from "./query";
import type { SaleInput } from "./types";

/**
 * Sold archive, stored in Turso (free 5 GB SQLite) so we can keep every sale.
 * Titles are indexed with SQLite full-text search (FTS5).
 *
 * Moving to a new Turso database (2026-10-29): the old one (TURSO_DATABASE_URL) belongs to an account
 * on Trevor's work login; the new one (TURSO_NEW_*, created through his personal Vercel's Turso
 * integration) is his own. The archive cron copies the old rows across a chunk at a time
 * (lib/archive-move.ts). Once the copy has caught up it marks the "move" job done in the new
 * database, and from then on the new database is the archive everywhere.
 */

let oldClient: Client | null = null;
let newClient: Client | null = null;
const schemaReady = new WeakSet<Client>();
let moved: { done: boolean; checkedAt: number } | null = null;
const MOVE_CHECK_MS = 5 * 60 * 1000;

const oldUrl = () => process.env.TURSO_DATABASE_URL;
const oldToken = () => process.env.TURSO_AUTH_TOKEN;
const newUrl = () =>
  process.env.TURSO_NEW_DATABASE_URL || process.env.TURSO_NEW_URL || process.env.TURSO_NEW_LIBSQL_URL;
const newToken = () =>
  process.env.TURSO_NEW_AUTH_TOKEN || process.env.TURSO_NEW_TOKEN || process.env.TURSO_NEW_DATABASE_TOKEN;

export function oldArchiveConfigured() {
  return Boolean(oldUrl() && oldToken());
}

export function newArchiveConfigured() {
  return Boolean(newUrl() && newToken());
}

export function archiveEnabled() {
  return oldArchiveConfigured() || newArchiveConfigured();
}

async function ensureSchema(db: Client) {
  if (schemaReady.has(db)) return;
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY,
        source TEXT NOT NULL,
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT,
        image_url TEXT,
        price REAL,
        sale_type TEXT,
        sold_at TEXT,
        first_seen_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS sales_source_ext ON sales(source, external_id)`,
      // Nothing reads this index, and every index adds to the monthly write count.
      `DROP INDEX IF EXISTS sales_sold_at`,
      `CREATE VIRTUAL TABLE IF NOT EXISTS sales_fts USING fts5(title, content='sales', content_rowid='id', tokenize='unicode61 remove_diacritics 2')`,
      `CREATE TRIGGER IF NOT EXISTS sales_ai AFTER INSERT ON sales BEGIN
        INSERT INTO sales_fts(rowid, title) VALUES (new.id, new.title);
      END`,
      `CREATE TABLE IF NOT EXISTS jobs (name TEXT PRIMARY KEY, state TEXT, updated_at TEXT)`,
    ],
    "write",
  );
  schemaReady.add(db);
}

const connect = (url: string, authToken: string) =>
  createClient({ url: url.replace(/^libsql:\/\//, "https://"), authToken });

/** The old archive (work-login Turso account). Only the move code should need this directly. */
export async function getOldArchive(): Promise<Client> {
  if (!oldArchiveConfigured()) throw new Error("Old Turso archive is not configured");
  if (!oldClient) oldClient = connect(oldUrl()!, oldToken()!);
  await ensureSchema(oldClient);
  return oldClient;
}

/** The new archive (Trevor's personal Turso account). */
export async function getNewArchive(): Promise<Client> {
  if (!newArchiveConfigured()) throw new Error("New Turso archive is not configured");
  if (!newClient) newClient = connect(newUrl()!, newToken()!);
  await ensureSchema(newClient);
  return newClient;
}

/** True once the copy into the new database has caught up (checked every few minutes). */
export async function archiveMoved(force = false): Promise<boolean> {
  if (!newArchiveConfigured()) return false;
  if (!oldArchiveConfigured()) return true;
  if (!force && moved && (moved.done || Date.now() - moved.checkedAt < MOVE_CHECK_MS)) return moved.done;
  try {
    const db = await getNewArchive();
    const r = await db.execute({ sql: "SELECT state FROM jobs WHERE name = 'move'", args: [] });
    const st = r.rows[0]?.state ? JSON.parse(String(r.rows[0].state)) : null;
    moved = { done: Boolean(st?.done), checkedAt: Date.now() };
  } catch {
    moved = { done: false, checkedAt: Date.now() };
  }
  return moved.done;
}

/** Called by the move code the moment the copy catches up, so this instance switches at once. */
export function markArchiveMoved() {
  moved = { done: true, checkedAt: Date.now() };
}

/** The archive to read and write: the new database once the move is done, otherwise the old one. */
export async function getArchive(): Promise<Client> {
  if (!archiveEnabled()) throw new Error("Turso is not configured");
  return (await archiveMoved()) ? getNewArchive() : getOldArchive();
}

/**
 * Inserts sales we don't have yet, and corrects the price of ones we do if it changed.
 * Returns how many rows were added or corrected.
 */
export async function saveSales(rows: SaleInput[]): Promise<number> {
  if (!rows.length) return 0;
  const db = await getArchive();
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const stmts: InStatement[] = rows.slice(i, i + 500).map((r) => ({
      sql: `INSERT INTO sales (source, external_id, title, url, image_url, price, sale_type, sold_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(source, external_id) DO UPDATE SET price = excluded.price
            WHERE excluded.price IS NOT NULL AND sales.price IS NOT excluded.price`,
      args: [r.source, r.external_id, r.title, r.url, r.image_url, r.price, r.sale_type, r.sold_at],
    }));
    const res = await db.batch(stmts, "write");
    added += res.reduce((n, x) => n + x.rowsAffected, 0);
  }
  return added;
}

const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** Turns an eBay-style search into an FTS5 query using only the required words. */
export function toFtsQuery(q: string): string | null {
  const parts: string[] = [];
  const walk = (c: Clause) => {
    if (c.neg) return;
    if (c.kind === "term") parts.push(c.wildcard ? `${quote(c.value.replace(/\*/g, ""))}*` : quote(c.value));
    if (c.kind === "phrase") parts.push(quote(c.words.join(" ")));
  };
  parseQuery(q).clauses.forEach(walk);
  const usable = parts.filter((p) => /[\p{L}\p{N}]/u.test(p));
  return usable.length ? usable.join(" AND ") : null;
}

export interface ArchiveSale {
  id: string;
  source: string;
  title: string;
  url: string | null;
  image_url: string | null;
  price: number | null;
  sale_type: string | null;
  sold_at: string | null;
}

/** Candidate sales for a search, newest first. Caller applies the full eBay-style match. */
export async function searchSales(q: string, limit = 5000): Promise<ArchiveSale[]> {
  const fts = toFtsQuery(q);
  if (!fts) return [];
  const db = await getArchive();
  const res = await db.execute({
    sql: `SELECT s.id, s.source, s.title, s.url, s.image_url, s.price, s.sale_type, s.sold_at
          FROM sales_fts f JOIN sales s ON s.id = f.rowid
          WHERE sales_fts MATCH ?
          ORDER BY s.sold_at DESC
          LIMIT ?`,
    args: [fts, limit],
  });
  return res.rows.map((r) => ({
    id: String(r.id),
    source: String(r.source),
    title: String(r.title),
    url: (r.url as string | null) ?? null,
    image_url: (r.image_url as string | null) ?? null,
    price: r.price == null ? null : Number(r.price),
    sale_type: (r.sale_type as string | null) ?? null,
    sold_at: (r.sold_at as string | null) ?? null,
  }));
}

export async function getJob<T>(name: string): Promise<T | null> {
  const db = await getArchive();
  const r = await db.execute({ sql: "SELECT state FROM jobs WHERE name = ?", args: [name] });
  return r.rows[0]?.state ? (JSON.parse(String(r.rows[0].state)) as T) : null;
}

export async function setJob(name: string, state: unknown) {
  const db = await getArchive();
  await db.execute({
    sql: `INSERT INTO jobs (name, state, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(name) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
    args: [name, JSON.stringify(state), new Date().toISOString()],
  });
}

export async function countSales() {
  const db = await getArchive();
  const r = await db.execute("SELECT source, COUNT(*) AS n FROM sales GROUP BY source");
  return Object.fromEntries(r.rows.map((x) => [String(x.source), Number(x.n)]));
}

export interface TickerSale {
  title: string;
  price: number;
  source: string;
}

/**
 * A random spread of real sales for the home-page backdrop.
 * Looks rows up by id, so it reads a few hundred rows instead of scanning the table.
 */
export async function sampleSales(count = 260): Promise<TickerSale[]> {
  const db = await getArchive();
  const top = await db.execute("SELECT MAX(id) AS n FROM sales");
  const max = Number(top.rows[0]?.n ?? 0);
  if (!max) return [];
  const ids = new Set<number>();
  // Ask for extra: some ids are gaps or have no price.
  const want = Math.min(max, Math.ceil(count * 1.6));
  while (ids.size < want) ids.add(1 + Math.floor(Math.random() * max));
  const res = await db.execute(
    `SELECT title, price, source FROM sales WHERE id IN (${[...ids].join(",")}) AND price > 0`,
  );
  return res.rows
    .map((r) => ({ title: String(r.title).replace(/\s+/g, " ").trim(), price: Number(r.price), source: String(r.source) }))
    .filter((s) => s.title.length > 12)
    .slice(0, count);
}
