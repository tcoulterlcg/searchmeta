import type { BuyingFormat, ListingInput, SaleInput } from "../types";
import { toSearchText } from "./fanatics";

/**
 * Goldin catalog crawler.
 * Goldin's site search reads from a public JSON endpoint. The whole live
 * catalog is only a few thousand lots, so each run pulls all of it
 * (1,000 lots per request) and the matcher sorts out what's new.
 */

const API = "https://d1wu47wucybvr3.cloudfront.net/api/lots_v2";
const PAGE_SIZE = 1000;
const MAX_PAGES = 30;
const IMAGE_BASE = "https://d2tt46f3mh26nl.cloudfront.net/public/Lots";

interface GoldinLot {
  lot_id: string;
  title: string;
  meta_slug: string;
  auction_type?: string;
  current_price?: number;
  min_bid_price?: number;
  primary_image_name?: string;
  start_timestamp?: string;
  end_timestamp?: string;
  status?: string;
  buyer_premium?: number;
}

async function fetchPage(from: number, extra: Record<string, unknown>): Promise<{ lots: GoldinLot[]; total: number }> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://goldin.co",
      Referer: "https://goldin.co/",
    },
    body: JSON.stringify({
      search: { queryType: "Recently_Started", keyword: "", size: PAGE_SIZE, from, ...extra },
    }),
  });
  if (!res.ok) throw new Error(`Goldin error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { searchalgolia?: { lots?: GoldinLot[]; total?: number } };
  return { lots: data.searchalgolia?.lots ?? [], total: data.searchalgolia?.total ?? 0 };
}

async function fetchAll(extra: Record<string, unknown>) {
  const out: GoldinLot[] = [];
  let calls = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { lots, total } = await fetchPage(page * PAGE_SIZE, extra);
    calls++;
    out.push(...lots);
    if (lots.length < PAGE_SIZE || out.length >= total) break;
  }
  return { lots: out, calls };
}

function toListing(l: GoldinLot): ListingInput {
  const fixed = l.auction_type === "Fixed_Price";
  const formats: BuyingFormat[] = fixed ? ["buy_it_now"] : ["auction"];
  const price = l.current_price && l.current_price > 0 ? l.current_price : l.min_bid_price ?? null;
  return {
    source: "goldin",
    external_id: l.lot_id,
    title: l.title,
    url: `https://goldin.co/item/${l.meta_slug}`,
    image_url: l.primary_image_name ? `${IMAGE_BASE}/${l.lot_id}/${l.primary_image_name}@1x` : null,
    price,
    currency: "USD",
    buying_formats: formats,
    graded: null,
    free_shipping: null,
    location_country: "US",
    listed_at: l.start_timestamp ?? null,
    ends_at: fixed ? null : l.end_timestamp ?? null,
  };
}

/** mode "buy_now" pulls only Buy Now listings (small and fast) for frequent checks. */
export async function fetchGoldinListings(
  mode: "all" | "buy_now" = "all",
): Promise<{ listings: ListingInput[]; calls: number }> {
  const empty = { lots: [] as GoldinLot[], calls: 0 };
  const [auctions, fixed] = await Promise.all([
    mode === "all" ? fetchAll({}) : Promise.resolve(empty),
    fetchAll({ auctionType: "Fixed_Price" }),
  ]);
  const byId = new Map<string, GoldinLot>();
  for (const l of [...auctions.lots, ...fixed.lots]) {
    if (l.lot_id && l.title && l.meta_slug) byId.set(l.lot_id, l);
  }
  return { listings: [...byId.values()].map(toListing), calls: auctions.calls + fixed.calls };
}

/** Live Goldin lots (auctions and Buy Now) matching a search, for the Search tab. */
export async function searchGoldinListings(keywords: string): Promise<ListingInput[]> {
  const keyword = toSearchText(keywords);
  if (!keyword) return [];
  const [auctions, fixed] = await Promise.all([
    fetchPage(0, { keyword }),
    fetchPage(0, { keyword, auctionType: "Fixed_Price" }),
  ]);
  const byId = new Map<string, GoldinLot>();
  for (const l of [...auctions.lots, ...fixed.lots]) {
    if (l.lot_id && l.title && l.meta_slug) byId.set(l.lot_id, l);
  }
  return [...byId.values()].map(toListing);
}

const SOLD_PAGES = 5;

/** Goldin's API stores some times without a zone; they're UTC. */
function toIso(t?: string) {
  if (!t) return null;
  const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toSale(l: GoldinLot): SaleInput {
  const hammer = l.current_price ?? null;
  const price = hammer != null ? Math.round(hammer * (1 + (l.buyer_premium ?? 0) / 100) * 100) / 100 : null;
  return {
    source: "goldin",
    external_id: l.lot_id,
    title: l.title,
    url: `https://goldin.co/item/${l.meta_slug}`,
    image_url: l.primary_image_name ? `${IMAGE_BASE}/${l.lot_id}/${l.primary_image_name}@1x` : null,
    price,
    sale_type: l.auction_type === "Fixed_Price" ? "buy_it_now" : "auction",
    sold_at: toIso(l.end_timestamp),
  };
}

/** One page of Goldin's sold archive. Price includes the buyer's premium (what the buyer paid). */
async function fetchSoldPage(opts: {
  keyword?: string;
  from: number;
  priceRange?: { min: number; max: number };
  size?: number;
  sort?: string;
}): Promise<{ sales: SaleInput[]; total: number; raw: number }> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://goldin.co", Referer: "https://goldin.co/" },
    body: JSON.stringify({
      search: {
        queryType: opts.sort ?? "Featured",
        keyword: opts.keyword ?? "",
        size: opts.size ?? PAGE_SIZE,
        from: opts.from,
        show_only: "Sold",
        ...(opts.priceRange ? { priceRange: opts.priceRange } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`Goldin sold error ${res.status}`);
  const data = (await res.json()) as { searchalgolia?: { lots?: GoldinLot[]; total?: number } };
  const lots = data.searchalgolia?.lots ?? [];
  return {
    sales: lots.filter((l) => l.lot_id && l.title && l.meta_slug).map(toSale),
    total: data.searchalgolia?.total ?? 0,
    raw: lots.length,
  };
}

/** Past Goldin sales for a search (archive goes back to 2012). */
export async function fetchGoldinSold(keywords: string): Promise<SaleInput[]> {
  const keyword = toSearchText(keywords);
  if (!keyword) return [];
  const out: SaleInput[] = [];
  for (let page = 0; page < SOLD_PAGES; page++) {
    const r = await fetchSoldPage({ keyword, from: page * PAGE_SIZE });
    out.push(...r.sales);
    if (r.raw < PAGE_SIZE || (page + 1) * PAGE_SIZE >= r.total) break;
  }
  return out;
}

/**
 * Full-archive copy. Goldin only lets a query page through its first 10,000
 * results, so the archive is split into price bands small enough to read whole.
 */
const WINDOW = 10_000;

interface Band {
  min: number;
  max: number;
  from: number;
  /** How many sales the band should hold (the largest count Goldin reported for it). */
  expect?: number;
  /** Sort order for this pass over the band. */
  sort?: string;
}

/**
 * Goldin's search is served by several servers and some hold an incomplete copy
 * (the same query reports ~625k sales on one and ~829k on another). So each band is
 * counted a few times and a page is only accepted from a server reporting the full count.
 */
const COUNT_PROBES = 3;
const PAGE_TRIES = 5;
const SECOND_SORT = "Recently_Started";

export interface GoldinBackfillState {
  queue: Band[];
  pages: number;
  saved: number;
  startedAt: string;
  finishedAt: string | null;
}

export function newGoldinBackfill(): GoldinBackfillState {
  return { queue: [{ min: 0, max: 100_000_000, from: 0 }], pages: 0, saved: 0, startedAt: new Date().toISOString(), finishedAt: null };
}

export async function goldinBackfillStep(
  state: GoldinBackfillState,
  save: (rows: SaleInput[]) => Promise<number>,
  deadline: number,
): Promise<GoldinBackfillState> {
  while (state.queue.length && Date.now() < deadline) {
    const band = state.queue[0];
    const priceRange = { min: band.min, max: band.max };

    if (band.expect == null) {
      let most = 0;
      for (let i = 0; i < COUNT_PROBES; i++) {
        most = Math.max(most, (await fetchSoldPage({ from: 0, priceRange, size: 1 })).total);
      }
      band.expect = most;
      if (most > WINDOW && band.max > band.min) {
        const mid = Math.floor((band.min + band.max) / 2);
        state.queue.splice(0, 1, { min: band.min, max: mid, from: 0 }, { min: mid + 1, max: band.max, from: 0 });
        continue;
      }
      if (most === 0) {
        state.queue.shift();
        continue;
      }
    }

    let r = await fetchSoldPage({ from: band.from, priceRange, sort: band.sort });
    for (let i = 1; i < PAGE_TRIES && r.total < band.expect; i++) {
      const again = await fetchSoldPage({ from: band.from, priceRange, sort: band.sort });
      if (again.total > r.total) r = again;
    }
    state.pages++;

    state.saved += await save(r.sales);
    const next = band.from + PAGE_SIZE;
    if (r.raw === PAGE_SIZE && next < Math.min(band.expect, WINDOW)) {
      band.from = next;
    } else if (band.expect > WINDOW && !band.sort) {
      // One price with more sales than a query can page through: read it again in another order to reach more of them.
      band.sort = SECOND_SORT;
      band.from = 0;
    } else {
      state.queue.shift();
    }
  }
  if (!state.queue.length && !state.finishedAt) state.finishedAt = new Date().toISOString();
  return state;
}
