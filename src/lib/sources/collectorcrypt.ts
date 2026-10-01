import type { ListingInput } from "../types";
import { UA } from "./html";

/**
 * Collector Crypt reader. Uses its public marketplace API (no key needed),
 * newest listings first.
 */

const API = "https://api.collectorcrypt.com/marketplace";
const SITE = "https://collectorcrypt.com";

type Card = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);

export function toCollectorCryptListing(c: Card): ListingInput | null {
  const listing = (c.listing ?? {}) as Card;
  const id = str(c.nftAddress) ?? str(c.id);
  const title = str(c.itemName) ?? str(c.name) ?? str(c.title);
  if (!id || !title) return null;
  const images = (c.images ?? {}) as Card;
  return {
    source: "collectorcrypt",
    external_id: id,
    title,
    url: `${SITE}/assets/solana/${id}`,
    image_url: str(images.frontM) ?? str(images.front) ?? str(c.frontImage) ?? str(c.image),
    price: num(listing.price) ?? num(c.listedPrice) ?? num(c.price),
    currency: str(listing.currency) ?? "USD",
    buying_formats: ["buy_it_now", "best_offer"],
    graded: str(c.gradingCompany) || str(c.grade) ? true : null,
    free_shipping: null,
    location_country: null,
    listed_at: null,
    ends_at: null,
  };
}

export async function fetchCollectorCryptListings(): Promise<{ listings: ListingInput[]; calls: number; fields: string }> {
  const res = await fetch(`${API}?step=100&page=1&orderBy=listedDateDesc`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Collector Crypt error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { filterNFtCard?: Card[] };
  const cards = data.filterNFtCard ?? [];
  const listings = cards.map(toCollectorCryptListing).filter((l): l is ListingInput => !!l);
  const first = cards[0] ?? {};
  const fields = [...Object.keys(first), ...Object.keys((first.listing ?? {}) as Card).map((k) => `listing.${k}`)].join(",");
  return { listings, calls: 1, fields };
}
