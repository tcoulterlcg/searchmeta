import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "./supabase/server";
import { archiveEnabled, getArchive } from "./archive";

const PAGE = 10_000;

function cell(v: unknown): string {
  if (v == null) return "";
  const s = Array.isArray(v) ? v.join("|") : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const line = (vals: unknown[]) => vals.map(cell).join(",") + "\r\n";

function csvHeaders(name: string) {
  const day = new Date().toISOString().slice(0, 10);
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="grailio-${name}-${day}.csv"`,
    "Cache-Control": "no-store",
  };
}

const SEARCH_COLS = [
  "id", "user_email", "name", "keywords", "search_description", "sources", "min_price", "max_price",
  "buying_formats", "condition", "free_shipping", "located_in", "notify", "created_at", "updated_at",
] as const;

const SALE_COLS = [
  "id", "source", "external_id", "title", "url", "image_url", "price", "sale_type", "sold_at", "first_seen_at",
] as const;

/** Every saved search on the site, one row each. */
async function searchesCsv() {
  const db = createServiceClient();
  const { data: searches, error } = await db.from("saved_searches").select("*").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const emails = new Map(users?.users.map((u) => [u.id, u.email ?? ""]));
  let out = "﻿" + line([...SEARCH_COLS]);
  for (const s of searches ?? []) {
    out += line(SEARCH_COLS.map((c) => (c === "user_email" ? emails.get(s.user_id) : s[c])));
  }
  return new NextResponse(out, { headers: csvHeaders("saved-searches") });
}

/** The sold archive, streamed in id order. `?source=goldin` limits it to one site. */
async function salesCsv(req: NextRequest) {
  if (!archiveEnabled()) return NextResponse.json({ error: "Sold archive is not configured" }, { status: 503 });
  const source = req.nextUrl.searchParams.get("source");
  const db = await getArchive();
  const enc = new TextEncoder();
  let after = 0;
  let started = false;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!started) {
          started = true;
          controller.enqueue(enc.encode("﻿" + line([...SALE_COLS])));
        }
        const res = await db.execute({
          sql: `SELECT ${SALE_COLS.join(", ")} FROM sales
                WHERE id > ? ${source ? "AND source = ?" : ""}
                ORDER BY id LIMIT ?`,
          args: source ? [after, source, PAGE] : [after, PAGE],
        });
        if (!res.rows.length) return controller.close();
        let out = "";
        for (const r of res.rows) out += line(SALE_COLS.map((c) => r[c]));
        after = Number(res.rows[res.rows.length - 1].id);
        controller.enqueue(enc.encode(out));
        if (res.rows.length < PAGE) controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
  return new NextResponse(stream, { headers: csvHeaders(source ? `sold-${source.replace(/[^a-z0-9-]/gi, "")}` : "sold") });
}

/** Flat-file backup by name: "searches" or "sales". */
export function exportFile(file: string, req: NextRequest) {
  if (file === "searches") return searchesCsv();
  if (file === "sales") return salesCsv(req);
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
