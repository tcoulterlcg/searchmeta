import type { BuyingFormat, ListingInput, SavedSearch } from "../types";
import { parseQuery, type Clause } from "../query";

/**
 * Fanatics Collect search.
 * Fanatics has ~175k live listings and its search index can't be sorted or
 * filtered by date, so instead of crawling the catalog we run each distinct
 * saved-search query against their search service (batched, 50 per call).
 * Cost grows with the number of *distinct* searches, not users.
 */

const APP_ID = "3XT9C4X62I";
const ALGOLIA = `https://${APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries`;
const GRAPHQL = "https://app.fanaticscollect.com/graphql";
const INDEX = "prod_item_state_v1";
const HITS_PER_QUERY = 100;
const BATCH = 50;

let cachedKey: { key: string; expires: number } | null = null;

async function getSearchKey(): Promise<string> {
  if (cachedKey && cachedKey.expires > Date.now() + 60_000) return cachedKey.key;
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://www.fanaticscollect.com",
      Referer: "https://www.fanaticscollect.com/",
    },
    body: JSON.stringify({
      operationName: "webSearchKeyQuery",
      query: "query webSearchKeyQuery { collectSearchKeyV2 { key validUntil } }",
      variables: {},
    }),
  });
  if (!res.ok) throw new Error(`Fanatics key error ${res.status}`);
  const data = (await res.json()) as { data?: { collectSearchKeyV2?: { key: string; validUntil: string } } };
  const k = data.data?.collectSearchKeyV2;
  if (!k?.key) throw new Error("Fanatics key missing from response");
  cachedKey = { key: k.key, expires: new Date(k.validUntil).getTime() };
  return k.key;
}

interface FanaticsHit {
  listingUuid: string;
  title: string;
  subtitle?: string;
  marketplace?: string; // WEEKLY | PREMIER | FIXED
  currentPrice?: number;
  allowOffers?: boolean;
  gradingService?: string;
  images?: { primary?: { small?: string; medium?: string; large?: string } };
  listedAt?: number;
  createdAt?: number;
}

/** Turns a saved search into the plain words Fanatics' search needs. Our matcher does the exact filtering. */
export function toSearchText(keywords: string): string | null {
  const words: string[] = [];
  const walk = (c: Clause) => {
    if (c.neg) return;
    if (c.kind === "term" && !c.wildcard) words.push(c.value);
    if (c.kind === "phrase") words.push(...c.words);
  };
  parseQuery(keywords).clauses.forEach(walk);
  return words.length ? [...new Set(words)].join(" ") : null;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

function toListing(h: FanaticsHit): ListingInput {
  const m = h.marketplace ?? "WEEKLY";
  const fixed = m === "FIXED";
  const formats: BuyingFormat[] = fixed ? ["buy_it_now"] : ["auction"];
  if (fixed && h.allowOffers) formats.push("best_offer");
  const path = fixed ? "buy-now" : m === "PREMIER" ? "premier" : "weekly";
  const title = h.subtitle ? `${h.title} ${h.subtitle}` : h.title;
  return {
    source: "fanatics",
    external_id: h.listingUuid,
    title,
    url: `https://www.fanaticscollect.com/${path}/${h.listingUuid}/${slugify(h.title)}`,
    image_url: h.images?.primary?.medium ?? h.images?.primary?.small ?? null,
    price: h.currentPrice ?? null,
    currency: "USD",
    buying_formats: formats,
    graded: h.gradingService ? true : null,
    free_shipping: null,
    location_country: "US",
    listed_at: h.listedAt ? new Date(h.listedAt * 1000).toISOString() : null,
    ends_at: null,
  };
}

export async function fetchFanaticsListings(
  searches: SavedSearch[],
): Promise<{ listings: ListingInput[]; calls: number; queries: number }> {
  const queries = [...new Set(searches.map((s) => toSearchText(s.keywords)).filter((q): q is string => !!q))];
  if (queries.length === 0) return { listings: [], calls: 0, queries: 0 };

  const key = await getSearchKey();
  const byId = new Map<string, ListingInput>();
  let calls = 0;

  for (let i = 0; i < queries.length; i += BATCH) {
    const chunk = queries.slice(i, i + BATCH);
    const res = await fetch(ALGOLIA, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-algolia-api-key": key,
        "x-algolia-application-id": APP_ID,
        Origin: "https://www.fanaticscollect.com",
        Referer: "https://www.fanaticscollect.com/",
      },
      body: JSON.stringify({
        requests: chunk.map((query) => ({
          indexName: INDEX,
          query,
          hitsPerPage: HITS_PER_QUERY,
          page: 0,
          filters: '(status:"Live")',
          typoTolerance: false,
          attributesToRetrieve: [
            "listingUuid", "title", "subtitle", "marketplace", "currentPrice",
            "allowOffers", "gradingService", "images.primary", "listedAt",
          ],
          attributesToHighlight: [],
        })),
      }),
    });
    calls++;
    if (!res.ok) throw new Error(`Fanatics search error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { results: { hits: FanaticsHit[] }[] };
    for (const r of data.results) {
      for (const h of r.hits) if (h.listingUuid && h.title) byId.set(h.listingUuid, toListing(h));
    }
  }
  return { listings: [...byId.values()], calls, queries: queries.length };
}
