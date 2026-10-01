import { createClient, type Client, type InStatement } from "@libsql/client/web";
import { parseQuery, type Clause } from "./query";
import type { SaleInput } from "./types";

/**
 * Sold archive, stored in Turso (free 5 GB SQLite) so we can keep every sale.
 * Titles are indexed with SQLite full-text search (FTS5).
 */

let client: Client | null = null;
let schemaReady = false;

export function archiveEnabled() {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

export async function getArchive(): Promise<Client> {
  if (!archiveEnabled()) throw new Error("Turso is not configured");
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!.replace(/^libsql:\/\//, "https://"),
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
  }
  if (!schemaReady) {
    await client.batch(
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
    schemaReady = true;
  }
  return client;
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
