import type { BuyingFormat, ListingInput } from "../types";

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
