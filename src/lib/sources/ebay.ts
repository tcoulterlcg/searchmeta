import type { BuyingFormat, ListingInput } from "../types";

/**
 * eBay category watcher.
 * Pulls the newest listings in a category via the Browse API (sorted newest first)
 * and pages back until it reaches listings older than the last watermark.
 * Cost scales with eBay's listing volume, not with number of users or searches.
 */

const API = process.env.EBAY_ENV === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
// 261328 = Sports Trading Card Singles. Comma-separate to watch more categories.
const CATEGORY_IDS = process.env.EBAY_CATEGORY_IDS || "261328";
const PAGE_SIZE = 200;
const MAX_PAGES = 10;

let cachedToken: { token: string; expires: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token;
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not set");

  const res = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  if (!res.ok) throw new Error(`eBay token error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

interface EbayItemSummary {
  itemId: string;
  title: string;
  itemWebUrl: string;
  itemAffiliateWebUrl?: string;
  image?: { imageUrl: string };
  price?: { value: string; currency: string };
  currentBidPrice?: { value: string; currency: string };
  buyingOptions?: string[];
  itemCreationDate?: string;
  itemEndDate?: string;
  itemLocation?: { country?: string };
  shippingOptions?: { shippingCost?: { value: string } }[];
  conditionId?: string;
  shortDescription?: string;
}

function mapFormats(opts: string[] = []): BuyingFormat[] {
  const out: BuyingFormat[] = [];
  if (opts.includes("AUCTION")) out.push("auction");
  if (opts.includes("FIXED_PRICE")) out.push("buy_it_now");
  if (opts.includes("BEST_OFFER")) out.push("best_offer");
  return out;
}

function toListing(i: EbayItemSummary): ListingInput {
  const price = i.currentBidPrice ?? i.price;
  const ship = i.shippingOptions?.[0]?.shippingCost?.value;
  return {
    source: "ebay",
    external_id: i.itemId,
    title: i.title,
    description: i.shortDescription ?? null,
    url: i.itemAffiliateWebUrl ?? i.itemWebUrl,
    image_url: i.image?.imageUrl ?? null,
    price: price ? Number(price.value) : null,
    currency: price?.currency ?? "USD",
    buying_formats: mapFormats(i.buyingOptions),
    // 2750 = Graded, 4000 = Ungraded for trading cards
    graded: i.conditionId === "2750" ? true : i.conditionId === "4000" ? false : null,
    free_shipping: ship == null ? null : Number(ship) === 0,
    location_country: i.itemLocation?.country ?? null,
    listed_at: i.itemCreationDate ?? null,
    ends_at: i.itemEndDate ?? null,
  };
}

export async function fetchNewEbayListings(
  watermark: Date | null,
): Promise<{ listings: ListingInput[]; newWatermark: Date | null; calls: number }> {
  const token = await getToken();
  const listings: ListingInput[] = [];
  let newest: Date | null = watermark;
  let calls = 0;
  // First run: only look back 10 minutes so we don't alert on old inventory.
  const floor = watermark ?? new Date(Date.now() - 10 * 60_000);

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      category_ids: CATEGORY_IDS,
      sort: "newlyListed",
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    };
    if (process.env.EPN_CAMPAIGN_ID) {
      headers["X-EBAY-C-ENDUSERCTX"] = `affiliateCampaignId=${process.env.EPN_CAMPAIGN_ID}`;
    }

    const res = await fetch(`${API}/buy/browse/v1/item_summary/search?${params}`, { headers });
    calls++;
    if (!res.ok) throw new Error(`eBay search error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { itemSummaries?: EbayItemSummary[] };
    const items = data.itemSummaries ?? [];

    let reachedOld = false;
    for (const item of items) {
      const created = item.itemCreationDate ? new Date(item.itemCreationDate) : null;
      if (created && created <= floor) {
        reachedOld = true;
        continue;
      }
      listings.push(toListing(item));
      if (created && (!newest || created > newest)) newest = created;
    }
    if (reachedOld || items.length < PAGE_SIZE) break;
  }

  return { listings, newWatermark: newest, calls };
}
