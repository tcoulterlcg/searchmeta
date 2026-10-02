import type { SupabaseClient } from "@supabase/supabase-js";
import { matchesQuery, parseQuery, prepareText } from "./query";
import { searchGoldinListings } from "./sources/goldin";
import { fetchFanaticsListings } from "./sources/fanatics";
import { HOUSES } from "./sources/houses";
import type { BuyingFormat, SavedSearch, SourceId } from "./types";

/**
 * What is for sale right now, for the Search tab.
 *  - Goldin and Fanatics Collect are asked live.
 *  - Auction houses come from `tracked_lots`, which holds every lot from their last catalog read.
 *  - Sites already matched by saved searches come from `listings`.
 * Every result then has to pass the full eBay-style match.
 */

export interface LiveListing {
  id: string;
  source: SourceId;
  title: string;
  url: string;
  image_url: string | null;
  price: number | null;
  format: BuyingFormat;
  ends_at: string | null;
  listed_at: string | null;
}

/** A lot is treated as still listed if the last few catalog reads saw it. */
const SEEN_WITHIN_MS = 3 * 60 * 60 * 1000;

/** Sites the Search tab covers today. */
export const LIVE_SOURCES: SourceId[] = ["goldin", "fanatics", ...HOUSES.map((h) => h.id)];

export async function searchLive(db: SupabaseClient, query: string): Promise<{ listings: LiveListing[]; failed: SourceId[] }> {
  const compiled = parseQuery(query);
  const failed: SourceId[] = [];
  const out = new Map<string, LiveListing>();
  const add = (l: LiveListing) => {
    if (l.title && matchesQuery(compiled, prepareText(l.title))) out.set(`${l.source}:${l.id}`, l);
  };

  const [goldin, fanatics, lots] = await Promise.allSettled([
    searchGoldinListings(query),
    fetchFanaticsListings([{ keywords: query } as SavedSearch]),
    db
      .from("tracked_lots")
      .select("source, external_id, title, url, image_url, bid, ends_at, last_seen_at")
      .is("final", null)
      .gt("last_seen_at", new Date(Date.now() - SEEN_WITHIN_MS).toISOString())
      .limit(10000),
  ]);

  const fromInput = (l: { source: SourceId; external_id: string; title: string; url: string; image_url?: string | null; price?: number | null; buying_formats: BuyingFormat[]; ends_at?: string | null; listed_at?: string | null }) =>
    add({
      id: l.external_id,
      source: l.source,
      title: l.title,
      url: l.url,
      image_url: l.image_url ?? null,
      price: l.price ?? null,
      format: l.buying_formats[0] ?? "auction",
      ends_at: l.ends_at ?? null,
      listed_at: l.listed_at ?? null,
    });

  if (goldin.status === "fulfilled") goldin.value.forEach(fromInput);
  else failed.push("goldin");
  if (fanatics.status === "fulfilled") fanatics.value.listings.forEach(fromInput);
  else failed.push("fanatics");
  if (lots.status === "fulfilled" && !lots.value.error) {
    for (const r of lots.value.data ?? []) {
      add({
        id: r.external_id,
        source: r.source as SourceId,
        title: r.title,
        url: r.url,
        image_url: r.image_url,
        price: r.bid == null ? null : Number(r.bid),
        format: "auction",
        ends_at: r.ends_at,
        listed_at: null,
      });
    }
  } else {
    failed.push(...HOUSES.map((h) => h.id));
  }
  return { listings: [...out.values()], failed };
}
