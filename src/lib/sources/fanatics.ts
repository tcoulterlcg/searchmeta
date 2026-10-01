import type { BuyingFormat, ListingInput, SaleInput, SavedSearch } from "../types";
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

export type { SaleInput } from "../types";

interface FanaticsSoldHit extends FanaticsHit {
  soldDate?: number;
  purchasePrice?: number | null;
  images?: { primary?: { small?: string; medium?: string; large?: string; thumbnail?: string } };
}

const SOLD_ATTRS = [
  "listingUuid", "title", "subtitle", "marketplace", "currentPrice", "purchasePrice", "images.primary", "soldDate",
];

/** Price is what the buyer paid (includes the buyer's premium on auctions), same as Goldin. */
export function toFanaticsSale(h: FanaticsSoldHit): SaleInput {
  const m = h.marketplace ?? "WEEKLY";
  const path = m === "FIXED" ? "buy-now" : m === "PREMIER" ? "premier" : "weekly";
  const img = h.images?.primary;
  return {
    source: "fanatics",
    external_id: h.listingUuid,
    title: h.subtitle ? `${h.title} ${h.subtitle}` : h.title,
    url: `https://www.fanaticscollect.com/${path}/${h.listingUuid}`,
    image_url: img?.medium ?? img?.small ?? img?.thumbnail ?? null,
    price: h.purchasePrice ?? h.currentPrice ?? null,
    sale_type: m === "FIXED" ? "buy_it_now" : "auction",
    sold_at: h.soldDate ? new Date(h.soldDate * 1000).toISOString() : null,
  };
}

async function soldQueries(requests: Record<string, unknown>[]) {
  const key = await getSearchKey();
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
      requests: requests.map((r) => ({
        indexName: INDEX,
        query: "",
        filters: '(status:"Sold")',
        typoTolerance: false,
        attributesToHighlight: [],
        ...r,
      })),
    }),
  });
  if (!res.ok) throw new Error(`Fanatics sold search error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { results: { hits?: FanaticsSoldHit[]; nbHits?: number }[] };
  return data.results;
}

/** Looks up past Fanatics Collect sales (back to ~2021) matching a search. Up to 1,000 results. */
export async function fetchFanaticsSold(keywords: string): Promise<SaleInput[]> {
  const query = toSearchText(keywords);
  if (!query) return [];
  const [r] = await soldQueries([{ query, hitsPerPage: 1000, page: 0, attributesToRetrieve: SOLD_ATTRS }]);
  return (r?.hits ?? []).filter((h) => h.listingUuid && h.title).map(toFanaticsSale);
}

/**
 * Full-archive copy. Fanatics only returns the first 2,399 results of any
 * query, so the archive is read in slices of sale time small enough to fit.
 * It walks backward from today (newest sales first) and re-checks hourly for
 * new sales.
 */
const WINDOW_LIMIT = 2399;
const TARGET = 1500;
const MAX_WINDOW = 30 * 86_400;
const NEW_SALES_EVERY_MS = 60 * 60 * 1000;
const NEW_SALES_OVERLAP = 6 * 3600;

export interface FanaticsBackfillState {
  /** Every sale at or after this time (unix seconds) has been copied. */
  tail: number;
  /** New sales have been copied up to this time. */
  head: number;
  /** Where an unfinished new-sales check should resume. */
  forwardFrom: number | null;
  headCheckedAt: string;
  window: number;
  saved: number;
  calls: number;
  month: string;
  monthSaved: number;
  startedAt: string;
  finishedAt: string | null;
}

export function newFanaticsBackfill(): FanaticsBackfillState {
  const now = Math.floor(Date.now() / 1000);
  const iso = new Date().toISOString();
  return {
    tail: now, head: now, forwardFrom: null, headCheckedAt: iso, window: 600,
    saved: 0, calls: 0, month: iso.slice(0, 7), monthSaved: 0, startedAt: iso, finishedAt: null,
  };
}

/** Next slice length, aiming for TARGET sales per slice. Grows at most 4x per step. */
export function nextWindow(window: number, total: number): number {
  const ideal = Math.floor((window * TARGET) / Math.max(total, 1));
  return Math.max(1, Math.min(ideal, window * 4, MAX_WINDOW));
}

/** Sales with from <= soldDate < to, plus how many sales are older than `from`. */
async function fetchSoldWindow(from: number, to: number) {
  const numericFilters = [`soldDate>=${from}`, `soldDate<${to}`];
  const results = await soldQueries([
    ...[0, 1, 2].map((page) => ({ numericFilters, hitsPerPage: 1000, page, attributesToRetrieve: SOLD_ATTRS })),
    { numericFilters: [`soldDate<${from}`], hitsPerPage: 0 },
  ]);
  const byId = new Map<string, SaleInput>();
  for (const r of results.slice(0, 3)) {
    for (const h of r.hits ?? []) if (h.listingUuid && h.title) byId.set(h.listingUuid, toFanaticsSale(h));
  }
  return { sales: [...byId.values()], total: results[0]?.nbHits ?? 0, older: results[3]?.nbHits ?? 0 };
}

/**
 * One timed step of the copy. `monthlyCap` limits how many new sales are saved
 * per calendar month (0 = no limit) so the archive database's monthly write
 * allowance isn't used up. New-sales checks are never held back by the cap.
 */
export async function fanaticsBackfillStep(
  state: FanaticsBackfillState,
  save: (rows: SaleInput[]) => Promise<number>,
  deadline: number,
  monthlyCap: number,
): Promise<FanaticsBackfillState> {
  const month = new Date().toISOString().slice(0, 7);
  if (state.month !== month) {
    state.month = month;
    state.monthSaved = 0;
  }
  const record = (n: number) => {
    state.saved += n;
    state.monthSaved += n;
  };

  // 1. New sales since the last check (hourly, with some overlap for late updates).
  if (state.forwardFrom == null && Date.now() - Date.parse(state.headCheckedAt) > NEW_SALES_EVERY_MS) {
    state.forwardFrom = state.head - NEW_SALES_OVERLAP;
  }
  let fw = 3600;
  while (state.forwardFrom != null && Date.now() < deadline) {
    const now = Math.floor(Date.now() / 1000);
    const from = state.forwardFrom;
    const to = Math.min(from + fw, now + 1);
    const r = await fetchSoldWindow(from, to);
    state.calls++;
    if (r.total > WINDOW_LIMIT && to - from > 1) {
      fw = nextWindow(to - from, r.total);
      continue;
    }
    record(await save(r.sales));
    fw = nextWindow(to - from, r.total);
    if (to > now) {
      state.head = now;
      state.forwardFrom = null;
      state.headCheckedAt = new Date().toISOString();
    } else {
      state.forwardFrom = to;
    }
  }

  // 2. Older sales, newest first.
  while (!state.finishedAt && Date.now() < deadline && (monthlyCap <= 0 || state.monthSaved < monthlyCap)) {
    const to = state.tail;
    const from = to - state.window;
    const r = await fetchSoldWindow(from, to);
    state.calls++;
    if (r.total > WINDOW_LIMIT && state.window > 1) {
      state.window = nextWindow(state.window, r.total);
      continue;
    }
    record(await save(r.sales));
    state.tail = from;
    state.window = nextWindow(state.window, r.total);
    if (r.older === 0) state.finishedAt = new Date().toISOString();
  }
  return state;
}
