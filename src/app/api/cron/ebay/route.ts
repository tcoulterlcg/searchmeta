import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchNewEbayListings } from "@/lib/sources/ebay";
import { ingestListings } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Called every minute by a scheduler. Protected by CRON_SECRET. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  const secret = process.env.CRON_SECRET;
  if (!secret || (auth !== `Bearer ${secret}` && key !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const { data: state } = await db.from("crawl_state").select("*").eq("source", "ebay").maybeSingle();
  const watermark = state?.watermark ? new Date(state.watermark) : null;

  try {
    const { listings, newWatermark, calls } = await fetchNewEbayListings(watermark);
    const result = await ingestListings(db, "ebay", listings);
    await db.from("crawl_state").upsert({
      source: "ebay",
      watermark: newWatermark?.toISOString() ?? state?.watermark ?? null,
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_count: listings.length,
    });
    return NextResponse.json({ ok: true, fetched: listings.length, calls, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from("crawl_state").upsert({
      source: "ebay",
      watermark: state?.watermark ?? null,
      last_run_at: new Date().toISOString(),
      last_status: `error: ${message.slice(0, 500)}`,
      last_count: 0,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
