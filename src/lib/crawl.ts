import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestListings, loadActiveSearches } from "./ingest";
import { fetchNewEbayListings } from "./sources/ebay";
import { fetchGoldinListings } from "./sources/goldin";
import { fetchFanaticsListings } from "./sources/fanatics";
import { fetchMyCardPostListings } from "./sources/mycardpost";
import { fetchSothebysListings } from "./sources/sothebys";
import { fetchMySlabsListings } from "./sources/myslabs";
import { fetchCollectorCryptListings } from "./sources/collectorcrypt";
import { fetchHouseListings, houseById, HOUSES } from "./sources/houses";
import type { ListingInput, SourceId } from "./types";

export const CRAWLABLE: SourceId[] = [
  "ebay", "goldin", "fanatics", "mycardpost", "sothebys", "myslabs", "collectorcrypt",
  ...HOUSES.map((h) => h.id),
];

interface CrawlState {
  watermark: string | null;
  cursor: string | null;
}

/** Runs one source end to end: fetch → match → store → alert, and records the result. */
export async function runSource(
  db: SupabaseClient,
  source: SourceId,
  opts: { debug?: boolean; mode?: string } = {},
) {
  const { data: state } = await db.from("crawl_state").select("*").eq("source", source).maybeSingle<CrawlState>();

  try {
    let listings: ListingInput[] = [];
    let watermark = state?.watermark ?? null;
    let cursor = state?.cursor ?? null;
    const extra: Record<string, number | string> = {};
    const house = houseById(source);

    if (source === "ebay") {
      const r = await fetchNewEbayListings(watermark ? new Date(watermark) : null);
      listings = r.listings;
      watermark = r.newWatermark?.toISOString() ?? watermark;
      extra.calls = r.calls;
    } else if (source === "goldin") {
      const r = await fetchGoldinListings(opts.mode === "buy_now" ? "buy_now" : "all");
      listings = r.listings;
      extra.calls = r.calls;
    } else if (source === "fanatics") {
      const searches = await loadActiveSearches(db, "fanatics");
      const r = await fetchFanaticsListings(searches);
      listings = r.listings;
      extra.calls = r.calls;
      extra.queries = r.queries;
    } else if (source === "mycardpost") {
      const r = await fetchMyCardPostListings(cursor ? Number(cursor) : null);
      listings = r.listings;
      cursor = r.newestId != null ? String(r.newestId) : cursor;
      extra.calls = r.calls;
    } else if (source === "sothebys") {
      const r = await fetchSothebysListings(cursor ? Number(cursor) : 0);
      listings = r.listings;
      cursor = String(r.nextCursor);
      extra.calls = r.calls;
      extra.auctions = r.auctions;
    } else if (source === "myslabs") {
      const r = await fetchMySlabsListings(cursor ? Number(cursor) : null);
      listings = r.listings;
      cursor = r.newestId != null ? String(r.newestId) : cursor;
      extra.calls = r.calls;
    } else if (source === "collectorcrypt") {
      const r = await fetchCollectorCryptListings();
      listings = r.listings;
      extra.calls = r.calls;
      if (opts.debug) extra.fields = r.fields;
    } else if (house) {
      const r = await fetchHouseListings(house, cursor ? Number(cursor) : 1);
      listings = r.listings;
      cursor = String(r.nextCursor);
      extra.calls = r.calls;
      extra.lotsOnPage = r.parsed;
      if (opts.debug) extra.note = r.note;
    } else {
      throw new Error(`No crawler for ${source}`);
    }

    if (opts.debug) {
      return { ok: true as const, source, debug: true, fetched: listings.length, sample: listings.slice(0, 3), ...extra };
    }

    const result = await ingestListings(db, source, listings);
    await db.from("crawl_state").upsert({
      source,
      watermark,
      cursor,
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_count: listings.length,
    });
    return { ok: true as const, source, fetched: listings.length, ...extra, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!opts.debug) {
      await db.from("crawl_state").upsert({
        source,
        watermark: state?.watermark ?? null,
        cursor: state?.cursor ?? null,
        last_run_at: new Date().toISOString(),
        last_status: `error: ${message.slice(0, 500)}`,
        last_count: 0,
      });
    }
    return { ok: false as const, source, error: message };
  }
}
