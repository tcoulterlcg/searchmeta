import type { SupabaseClient } from "@supabase/supabase-js";
import { SearchIndex } from "./matcher";
import { sendPushToUser } from "./push";
import type { ListingInput, SavedSearch, SourceId } from "./types";

const SOURCE_NAMES: Record<SourceId, string> = {
  ebay: "eBay",
  goldin: "Goldin",
  fanatics: "Fanatics Collect",
  heritage: "Heritage",
};

/**
 * Takes a batch of listings from any source, matches them against every saved
 * search, stores only the listings that matched someone, records matches, and
 * pushes alerts for matches that are new.
 */
export async function ingestListings(db: SupabaseClient, source: SourceId, batch: ListingInput[]) {
  if (batch.length === 0) return { matchedListings: 0, newMatches: 0, pushes: 0 };

  const index = new SearchIndex(await loadActiveSearches(db, source));
  const matched: { listing: ListingInput; searches: SavedSearch[] }[] = [];
  for (const l of batch) {
    const hits = index.match(l);
    if (hits.length) matched.push({ listing: l, searches: hits });
  }
  if (matched.length === 0) return { matchedListings: 0, newMatches: 0, pushes: 0 };

  const { error: upErr } = await db
    .from("listings")
    .upsert(
      matched.map((m) => m.listing),
      { onConflict: "source,external_id", ignoreDuplicates: true },
    );
  if (upErr) throw upErr;

  const { data: rows, error: selErr } = await db
    .from("listings")
    .select("id, external_id")
    .eq("source", source)
    .in("external_id", matched.map((m) => m.listing.external_id));
  if (selErr) throw selErr;
  const idByExternal = new Map((rows ?? []).map((r) => [r.external_id, r.id as string]));

  const matchRows = matched.flatMap(({ listing, searches }) =>
    searches
      .map((s) => ({ saved_search_id: s.id, user_id: s.user_id, listing_id: idByExternal.get(listing.external_id) }))
      .filter((r): r is { saved_search_id: string; user_id: string; listing_id: string } => !!r.listing_id),
  );

  // ignoreDuplicates => only genuinely new matches come back, so we never double-alert.
  const { data: inserted, error: mErr } = await db
    .from("matches")
    .upsert(matchRows, { onConflict: "saved_search_id,listing_id", ignoreDuplicates: true })
    .select("id, user_id, saved_search_id, listing_id");
  if (mErr) throw mErr;

  const searchById = new Map(matched.flatMap((m) => m.searches).map((s) => [s.id, s]));
  const listingById = new Map(
    matched.map((m) => [idByExternal.get(m.listing.external_id), m.listing] as const),
  );

  let pushes = 0;
  const notified: string[] = [];
  const done = new Set<string>();
  for (const row of inserted ?? []) {
    const search = searchById.get(row.saved_search_id);
    const listing = listingById.get(row.listing_id);
    if (!search?.notify || !listing) continue;
    const key = `${row.user_id}:${row.listing_id}`;
    if (done.has(key)) continue;
    done.add(key);
    const price = listing.price != null ? ` · $${listing.price.toLocaleString("en-US")}` : "";
    pushes += await sendPushToUser(db, row.user_id, {
      title: `${search.name} · ${SOURCE_NAMES[listing.source]}`,
      body: `${listing.title}${price}`,
      url: listing.url,
      image: listing.image_url,
      tag: `${listing.source}-${listing.external_id}`,
    });
    notified.push(row.id);
  }
  if (notified.length) {
    await db.from("matches").update({ notified_at: new Date().toISOString() }).in("id", notified);
  }

  return { matchedListings: matched.length, newMatches: inserted?.length ?? 0, pushes };
}

export async function loadActiveSearches(db: SupabaseClient, source: SourceId): Promise<SavedSearch[]> {
  const all: SavedSearch[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("saved_searches")
      .select("*")
      .contains("sources", [source])
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...((data ?? []) as SavedSearch[]));
    if (!data || data.length < pageSize) break;
  }
  return all;
}
