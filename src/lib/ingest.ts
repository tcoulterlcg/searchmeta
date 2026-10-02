import type { SupabaseClient } from "@supabase/supabase-js";
import { SearchIndex } from "./matcher";
import { sendPushToUser, type PushPayload } from "./push";
import { PENDING_SOURCES, SOURCES, type ListingInput, type SavedSearch, type SourceId } from "./types";

const SOURCE_NAMES = Object.fromEntries([...SOURCES, ...PENDING_SOURCES].map((s) => [s.id, s.name])) as Record<SourceId, string>;

/**
 * Takes a batch of listings from any source, matches them against every saved
 * search, stores only the listings that matched someone, records matches, and
 * pushes alerts for matches that are new.
 */
const FORMAT_LABELS: Record<string, string> = { auction: "Auction", buy_it_now: "Buy It Now", best_offer: "Accepts Offers" };

/** At most this many separate alerts per person from one check; any more are rolled into one summary alert. */
const MAX_PUSHES_PER_RUN = 5;

type AlertListing = Pick<ListingInput, "source" | "external_id" | "title" | "url" | "image_url" | "price" | "buying_formats">;

/** The price and format line under a card's title, e.g. "$1,139 · Buy It Now". */
export function alertDetails(listing: AlertListing): string {
  return [
    listing.price != null ? `$${listing.price.toLocaleString("en-US")}` : null,
    FORMAT_LABELS[listing.buying_formats?.[0]] ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The phone alert for one match, laid out like an alert card: site and search on top,
 * the card, then price and format. The website and the app send exactly this.
 */
export function alertPayload(listing: AlertListing, searchName: string): PushPayload {
  const details = alertDetails(listing);
  return {
    title: `🟢 ${SOURCE_NAMES[listing.source]} · ${searchName}`,
    body: details ? `${listing.title}\n${details}` : listing.title,
    url: listing.url,
    image: listing.image_url,
    tag: `${listing.source}-${listing.external_id}`,
  };
}

/**
 * `quiet` records matches without pushing. Used the first time a site is read, when
 * everything already listed there would otherwise arrive as a burst of alerts.
 */
export async function ingestListings(
  db: SupabaseClient,
  source: SourceId,
  batch: ListingInput[],
  opts: { quiet?: boolean } = {},
) {
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
  const sentTo = new Map<string, number>();
  const overflow = new Map<string, number>();
  for (const row of opts.quiet ? [] : inserted ?? []) {
    const search = searchById.get(row.saved_search_id);
    const listing = listingById.get(row.listing_id);
    if (!search?.notify || !listing) continue;
    // A brand-new search first matches everything already listed. Show those in Alerts,
    // but only push for listings that appear after the first 20 minutes.
    if (Date.now() - new Date(search.created_at).getTime() < 20 * 60_000) continue;
    const key = `${row.user_id}:${row.listing_id}`;
    if (done.has(key)) continue;
    done.add(key);
    if ((sentTo.get(row.user_id) ?? 0) >= MAX_PUSHES_PER_RUN) {
      overflow.set(row.user_id, (overflow.get(row.user_id) ?? 0) + 1);
      notified.push(row.id);
      continue;
    }
    sentTo.set(row.user_id, (sentTo.get(row.user_id) ?? 0) + 1);
    pushes += await sendPushToUser(db, row.user_id, alertPayload(listing, search.name));
    notified.push(row.id);
  }
  for (const [userId, more] of overflow) {
    pushes += await sendPushToUser(db, userId, {
      title: `🟢 ${SOURCE_NAMES[source]} · ${more} more ${more === 1 ? "match" : "matches"}`,
      body: "Open SearchMeta to see them all.",
      url: "/alerts",
      tag: `${source}-more`,
    });
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
