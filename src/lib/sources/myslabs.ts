import type { BuyingFormat, ListingInput } from "../types";
import { decode, getHtml, money, text } from "./html";

/**
 * MySlabs reader.
 * The home page lists the newest slabs first, 72 per page. Each run reads page 1
 * and keeps going only while it is still seeing slabs newer than last time.
 */

const BASE = "https://myslabs.com";
const MAX_PAGES = 4;

export function parseMySlabs(html: string): ListingInput[] {
  const out: ListingInput[] = [];
  for (const chunk of html.split(/<div\s+class="slab_item\b/).slice(1)) {
    const id = chunk.match(/\/slab\/view\/(\d+)\//)?.[1];
    if (!id) continue;
    const title =
      text(chunk.match(/class="slab-title">([\s\S]*?)<\/div>/)?.[1] ?? "") ||
      decode(chunk.match(/\balt="([^"]*)"/)?.[1] ?? "").trim();
    if (!title) continue;
    const image = chunk.match(/data-src="([^"]+)"/)?.[1];
    const formats: BuyingFormat[] = /auction|bid(?:-now)?\.png/i.test(chunk.split("application/ld+json")[0])
      ? ["auction"]
      : /offer/i.test(chunk) ? ["buy_it_now", "best_offer"] : ["buy_it_now"];
    out.push({
      source: "myslabs",
      external_id: id,
      title,
      url: `${BASE}/slab/view/${id}/`,
      image_url: image ? decode(image) : null,
      price: money(chunk.match(/class="item-price">([\s\S]*?)<\/div>/)?.[1]),
      currency: "USD",
      buying_formats: formats,
      graded: true,
      free_shipping: null,
      location_country: "US",
      listed_at: null,
      ends_at: null,
    });
  }
  return out;
}

export async function fetchMySlabsListings(
  newestSeen: number | null,
): Promise<{ listings: ListingInput[]; newestId: number | null; calls: number }> {
  const byId = new Map<string, ListingInput>();
  let calls = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await (await getHtml(page === 1 ? `${BASE}/` : `${BASE}/?page=${page}`)).text();
    calls++;
    const found = parseMySlabs(html);
    for (const l of found) byId.set(l.external_id, l);
    const oldest = Math.min(...found.map((l) => Number(l.external_id)));
    if (!found.length || newestSeen == null || oldest <= newestSeen) break;
  }
  const ids = [...byId.keys()].map(Number);
  return { listings: [...byId.values()], newestId: ids.length ? Math.max(...ids, newestSeen ?? 0) : newestSeen, calls };
}
