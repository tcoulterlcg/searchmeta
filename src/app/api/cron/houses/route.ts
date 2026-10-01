import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runSource } from "@/lib/crawl";
import { HOUSES } from "@/lib/sources/houses";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Each auction house is read at most this often; their catalogs only change when an auction opens. */
const MIN_INTERVAL_MS = 30 * 60 * 1000;
const BUDGET_MS = 30_000;

/**
 * Called every couple of minutes by pg_cron. Works through the auction houses in turn,
 * always taking the one that has waited longest. `?only=<id>&debug=1` test-reads a single house.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createServiceClient();
  const only = req.nextUrl.searchParams.get("only");
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  if (only) {
    const house = HOUSES.find((h) => h.id === only);
    if (!house) return NextResponse.json({ error: `unknown house: ${only}` }, { status: 404 });
    return NextResponse.json(await runSource(db, house.id, { debug }));
  }

  const { data: states } = await db
    .from("crawl_state")
    .select("source, last_run_at")
    .in("source", HOUSES.map((h) => h.id));
  const lastRun = new Map((states ?? []).map((s) => [s.source as string, s.last_run_at ? Date.parse(s.last_run_at) : 0]));
  const due = HOUSES
    .map((h) => ({ h, at: lastRun.get(h.id) ?? 0 }))
    .filter((x) => Date.now() - x.at > MIN_INTERVAL_MS)
    .sort((a, b) => a.at - b.at);

  const start = Date.now();
  const results = [];
  for (const { h } of due) {
    if (Date.now() - start > BUDGET_MS) break;
    results.push(await runSource(db, h.id));
  }
  return NextResponse.json({ ok: results.every((r) => r.ok), ran: results.length, waiting: due.length - results.length, results });
}
