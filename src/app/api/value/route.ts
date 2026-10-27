import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { matchesQuery, parseQuery, prepareText } from "@/lib/query";
import { archiveEnabled, searchSales } from "@/lib/archive";

export const dynamic = "force-dynamic";

/**
 * Market value for one card, from GrailFindr's sold archive. Used by Card HQ (My Collection →
 * "Get value"), which sends an eBay-style query built from its checklist:
 *   GET /api/value?q=2007-08 O-Pee-Chee Patrick Kane #518 -psa -bgs -sgc
 * Returns the median of the most recent matching sales (last 12 months), with a few examples.
 * Public and read-only; responses are cached at the edge for 12 hours.
 */
const ALLOWED_ORIGINS = new Set(["https://cardhq.vercel.app", "http://localhost:3005"]);
const RECENT_DAYS = 365;
const MAX_SALES = 40;

// a light per-instance limit so one visitor can't run the archive hot
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) { hits.set(ip, { n: 1, t: now }); return false; }
  h.n++;
  if (hits.size > 5000) hits.clear();
  return h.n > 60;
}

function cors(req: NextRequest, res: NextResponse) {
  const o = req.headers.get("origin") || "";
  if (ALLOWED_ORIGINS.has(o)) { res.headers.set("Access-Control-Allow-Origin", o); res.headers.set("Vary", "Origin"); }
  return res;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

interface Sale { title: string; url: string | null; price: number | null; sold_at: string | null; source: string }

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 200);
  const compiled = parseQuery(q);
  const positives = compiled.clauses.filter((c) => !c.neg);
  if (positives.length < 2) return cors(req, NextResponse.json({ error: "query too short" }, { status: 400 }));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return cors(req, NextResponse.json({ error: "slow down" }, { status: 429 }));

  let sales: Sale[] = [];
  try {
    if (archiveEnabled()) {
      sales = (await searchSales(q, 600)).filter((s) => matchesQuery(compiled, prepareText(s.title)));
    } else {
      const words = compiled.clauses
        .filter((c) => !c.neg && c.kind === "term" && !c.wildcard)
        .map((c) => (c.kind === "term" ? c.value : ""))
        .sort((a, b) => b.length - a.length)
        .slice(0, 3);
      let dbq = createServiceClient().from("sales").select("title, url, price, sold_at, source").order("sold_at", { ascending: false, nullsFirst: false }).limit(600);
      for (const w of words) dbq = dbq.ilike("title", `%${w.replace(/[%_\\]/g, "")}%`);
      const { data } = await dbq;
      sales = ((data ?? []) as Sale[]).filter((s) => matchesQuery(compiled, prepareText(s.title)));
    }
  } catch (e) {
    console.error("value lookup failed", e);
    return cors(req, NextResponse.json({ error: "lookup failed" }, { status: 502 }));
  }

  const since = Date.now() - RECENT_DAYS * 86_400_000;
  const recent = sales
    .filter((s) => Number(s.price) > 0 && s.sold_at && Date.parse(s.sold_at) >= since)
    .slice(0, MAX_SALES);
  const prices = recent.map((s) => Number(s.price));
  const body = {
    query: q,
    count: prices.length,
    median: prices.length ? Math.round(median(prices) * 100) / 100 : null,
    low: prices.length ? Math.min(...prices) : null,
    high: prices.length ? Math.max(...prices) : null,
    latest: recent[0]?.sold_at ?? null,
    examples: recent.slice(0, 5).map((s) => ({ title: s.title, price: Number(s.price), sold_at: s.sold_at, url: s.url, source: s.source })),
    searchUrl: "https://grailfindr.vercel.app/sold?mode=sold&q=" + encodeURIComponent(q),
  };
  const res = NextResponse.json(body);
  res.headers.set("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400");
  return cors(req, res);
}
