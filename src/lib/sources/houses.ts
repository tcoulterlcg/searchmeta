import type { ListingInput, SourceId } from "../types";
import { decode, getHtml, money, text } from "./html";

/**
 * Auction houses that run on shared auction software. One reader per software
 * covers every house on it:
 *  - "gallery": /Lots/Gallery pages, 250 lots each (Lelands, Memory Lane, Love of the Game, Collect Auctions)
 *  - "catalog": catalog.aspx (Sirius, Wheatland, Brockelman, Sterling, Detroit City Sports)
 */

export interface House {
  id: SourceId;
  platform: "gallery" | "catalog";
  /** Site root, no trailing slash. */
  base: string;
}

/**
 * Built and tested, but switched off: these four sites answer our reader with
 * "403 Forbidden" from the live servers (checked 10/1/2026). We don't disguise the
 * reader to get past that. Move a house into HOUSES once it lets SearchMetaBot in.
 */
export const BLOCKED_HOUSES: House[] = [
  { id: "lelands", platform: "gallery", base: "https://auction.lelands.com" },
  { id: "memorylane", platform: "gallery", base: "https://bid.memorylaneinc.com" },
  { id: "lotg", platform: "gallery", base: "https://bid.loveofthegameauctions.com" },
  { id: "collectauctions", platform: "gallery", base: "https://www.collectauctions.com" },
];

export const HOUSES: House[] = [
  { id: "sirius", platform: "catalog", base: "https://www.siriussportsauctions.com" },
  { id: "wheatland", platform: "catalog", base: "https://www.wheatlandauctionservices.com" },
  { id: "brockelman", platform: "catalog", base: "https://www.brockelmanauctions.com" },
  { id: "sterling", platform: "catalog", base: "https://www.sterlingsportsauctions.com" },
  { id: "detroitcity", platform: "catalog", base: "https://auctions.detroitcitysports.com" },
];

export const houseById = (id: string) => HOUSES.find((h) => h.id === id);

function listing(h: House, p: { id: string; title: string; url: string; image: string | null; price: number | null; endsAt?: string | null }): ListingInput {
  return {
    source: h.id,
    external_id: p.id,
    title: p.title,
    url: p.url,
    image_url: p.image,
    price: p.price,
    currency: "USD",
    buying_formats: ["auction"],
    graded: null,
    free_shipping: null,
    location_country: "US",
    listed_at: null,
    ends_at: p.endsAt ?? null,
  };
}

const absolute = (base: string, src: string) =>
  src.startsWith("http") ? src : `${base}/${src.replace(/^(\.\.\/|\/)+/, "")}`;

/* ---------- "gallery" software ---------- */

const GALLERY_PAGE_SIZE = 250;
const GALLERY_PAGES_PER_RUN = 2;
const CLOSED = /sold|closed|unsold|passed|ended|withdrawn/i;

/** Lots on one gallery page. `open` is false once a lot has closed. */
export function parseGallery(h: House, html: string): { lot: ListingInput; open: boolean }[] {
  const out: { lot: ListingInput; open: boolean }[] = [];
  for (const chunk of html.split(/<div class="item">/).slice(1)) {
    const link = chunk.match(/<p class="description">\s*<a href="[^"]*itemid=(\d+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const title = text(link[2]);
    if (!title) continue;
    const img = chunk.match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1];
    const status = text(chunk.match(/Status:\s*<strong>([\s\S]*?)<\/strong>/i)?.[1] ?? "");
    const priceText = text(chunk.match(/<div class="item-price">([\s\S]*?)<\/div>/i)?.[1] ?? "");
    const opening = chunk.match(/Opening Bid:\s*<strong>([^<]*)<\/strong>/i)?.[1];
    out.push({
      lot: listing(h, {
        id: link[1],
        title,
        url: `${h.base}/bids/bidplace.aspx?itemid=${link[1]}`,
        image: img ? absolute(h.base, decode(img)) : null,
        price: money(priceText) ?? money(opening),
      }),
      open: !CLOSED.test(status) && !/\bsold\b/i.test(priceText),
    });
  }
  return out;
}

async function fetchGallery(h: House, cursor: number) {
  const listings: ListingInput[] = [];
  let page = Math.max(1, cursor);
  let calls = 0;
  let parsed = 0;
  for (let i = 0; i < GALLERY_PAGES_PER_RUN; i++) {
    const html = await (await getHtml(`${h.base}/Lots/Gallery?page=${page}`)).text();
    calls++;
    const found = parseGallery(h, html);
    parsed += found.length;
    const open = found.filter((f) => f.open).map((f) => f.lot);
    listings.push(...open);
    // Stop at the last page, or when the auction on show has already closed.
    if (found.length < GALLERY_PAGE_SIZE || open.length === 0) {
      page = 1;
      break;
    }
    page++;
  }
  return { listings, nextCursor: page, calls, parsed, note: "" };
}

/* ---------- "catalog" software ---------- */

/** Lots on a catalog page. */
export function parseCatalog(h: House, html: string): ListingInput[] {
  const ends = html.match(/<title>[^<]*Ends\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  const endsAt = ends
    ? new Date(Date.UTC(Number(ends[3]) + (ends[3].length === 2 ? 2000 : 0), Number(ends[1]) - 1, Number(ends[2]) + 1, 3)).toISOString()
    : null;
  const out: ListingInput[] = [];
  for (const chunk of html.split(/<div class="lot\s*">/).slice(1)) {
    const link = chunk.match(/<a href='([^']*?([^'\/]+-LOT(\d+)\.aspx))'>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const title = text(link[4]);
    if (!title) continue;
    const img = chunk.match(/<img\b[^>]*?\b(?:data-src|data-original|src)=['"]([^'"]+)['"]/i)?.[1];
    out.push(
      listing(h, {
        id: link[3],
        title,
        url: `${h.base}/${link[2]}`,
        image: img ? absolute(h.base, decode(img)) : null,
        price: money(chunk.match(/Current Bid:\s*([^<]*)</i)?.[1]) ?? money(chunk.match(/Min Bid:\s*([^<]*)</i)?.[1]),
        endsAt,
      }),
    );
  }
  return out;
}

/** Every form field on the page with its current value, as the browser would submit it. */
export function formFields(html: string): URLSearchParams {
  const form = new URLSearchParams();
  for (const m of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = m[0];
    const name = tag.match(/\bname="([^"]*)"/i)?.[1];
    const type = (tag.match(/\btype="([^"]*)"/i)?.[1] ?? "text").toLowerCase();
    if (!name || ["submit", "button", "image", "checkbox", "radio", "file"].includes(type)) continue;
    form.set(name, decode(tag.match(/\bvalue="([^"]*)"/i)?.[1] ?? ""));
  }
  for (const m of html.matchAll(/<select\b[^>]*\bname="([^"]*)"[^>]*>([\s\S]*?)<\/select>/gi)) {
    const options = [...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)];
    const chosen = options.find((o) => /\bselected\b/i.test(o[1])) ?? options[0];
    if (chosen) form.set(m[1], decode(chosen[1].match(/\bvalue="([^"]*)"/i)?.[1] ?? text(chosen[2])));
  }
  return form;
}

/** The "lots per page" dropdown and the value of its "All" choice, if the page has one. */
export function lotsPerPageControl(html: string): { name: string; all: string } | null {
  for (const m of html.matchAll(/<select\b[^>]*\bname="([^"]*)"[^>]*>([\s\S]*?)<\/select>/gi)) {
    const options = [...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map((o) => ({
      value: decode(o[1].match(/\bvalue="([^"]*)"/i)?.[1] ?? text(o[2])),
      label: text(o[2]),
    }));
    const all = options.find((o) => /^all$/i.test(o.label));
    if (all && options.some((o) => /^\d+$/.test(o.label))) return { name: m[1], all: all.value };
  }
  return null;
}

async function fetchCatalog(h: House) {
  const url = `${h.base}/catalog.aspx`;
  const first = await getHtml(url);
  const html = await first.text();
  let calls = 1;
  let lots = parseCatalog(h, html);

  // The page shows 25 lots at a time; ask it for all of them the way the dropdown does.
  const control = lotsPerPageControl(html);
  // Shown only in test reads, to see how a house's page is laid out.
  let note =
    `first page ${lots.length}; dropdowns: ` +
    [...html.matchAll(/<select\b[^>]*\bname="([^"]*)"[^>]*>([\s\S]*?)<\/select>/gi)]
      .map((m) => `${m[1]}=[${[...m[2].matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)].map((o) => text(o[1])).slice(0, 8).join("|")}]`)
      .join("; ")
      .slice(0, 600) +
    `; pager: ${[...new Set([...html.matchAll(/__doPostBack\(&#39;([^&]+)&#39;,&#39;([^&]*)&#39;\)/g)].map((m) => `${m[1]}:${m[2]}`))].slice(0, 12).join(", ").slice(0, 500)}`;
  if (control && lots.length) {
    try {
      const form = formFields(html);
      form.set("__EVENTTARGET", control.name);
      form.set("__EVENTARGUMENT", "");
      form.set(control.name, control.all);
      const cookie = (first.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
      const res = await getHtml(url, {
        method: "POST",
        body: form.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: url, ...(cookie ? { Cookie: cookie } : {}) },
      });
      calls++;
      const all = parseCatalog(h, await res.text());
      note += `; all-lots request returned ${all.length}`;
      if (all.length > lots.length) lots = all;
    } catch (e) {
      // Keep the first page if the full list can't be loaded.
      note += `; all-lots request failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  const byId = new Map(lots.map((l) => [l.external_id, l]));
  return { listings: [...byId.values()], nextCursor: 1, calls, parsed: lots.length, note };
}

export async function fetchHouseListings(h: House, cursor: number) {
  return h.platform === "gallery" ? fetchGallery(h, cursor) : fetchCatalog(h);
}
