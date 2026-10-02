import type { BuyingFormat, ListingInput } from "../types";

/**
 * MyCardPost marketplace reader.
 * The public marketplace page is server-rendered HTML, newest first, and robots.txt
 * allows crawling. We read pages until we reach a listing ID we've already seen.
 */

const BASE = "https://mycardpost.com";
const MAX_PAGES = 5;
const LINK_RE = /href=["'](?:https?:\/\/mycardpost\.com)?(?:\/index\.php)?(\/marketplace\/[a-z0-9-]+\/[a-z0-9-]+\/(\d+))["']/gi;

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function text(s: string) {
  return decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function titleFromSlug(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Parses one marketplace page into listings (exported for tests). */
export function parseMarketplacePage(html: string): ListingInput[] {
  const hits: { path: string; id: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(LINK_RE.source, "gi");
  while ((m = re.exec(html))) hits.push({ path: m[1], id: m[2], index: m.index });

  const byId = new Map<string, ListingInput>();
  const firstIndex = new Map<string, number>();
  for (const h of hits) if (!firstIndex.has(h.id)) firstIndex.set(h.id, h.index);
  const ids = [...firstIndex.keys()];

  ids.forEach((id, i) => {
    const start = firstIndex.get(id)!;
    const end = i + 1 < ids.length ? firstIndex.get(ids[i + 1])! : Math.min(html.length, start + 4000);
    const card = html.slice(Math.max(0, start - 1500), end);
    const own = html.slice(start, end);
    const path = hits.find((h) => h.id === id)!.path;
    const slug = path.split("/")[3] ?? "";

    // Title: the longest link text pointing at this listing.
    let title = "";
    const aRe = new RegExp(`<a\\b[^>]*href=["'][^"']*\\/${id}["'][^>]*>([\\s\\S]*?)<\\/a>`, "gi");
    let a: RegExpExecArray | null;
    while ((a = aRe.exec(card))) {
      const t = text(a[1]);
      if (t.length > title.length && !/^\$/.test(t)) title = t;
    }
    // Card photos live under /frontend/card/; their alt text is usually the full title.
    const imgTag = own.match(/<img\b[^>]*(?:data-src|src)=["'][^"']*\/frontend\/card\/[^"']+["'][^>]*>/i)?.[0] ?? null;
    const img = imgTag?.match(/(?:data-src|src)=["']([^"']+)["']/i)?.[1] ?? null;
    const alt = imgTag ? text(imgTag.match(/alt=["']([^"']*)["']/i)?.[1] ?? "") : "";
    if (alt.length > title.length) title = alt;
    if (title.length < 8) title = titleFromSlug(slug);

    const priceMatch = own.match(/\$\s?([\d,]+(?:\.\d{2})?)/);
    const isAuction = /\bbids?\b|current bid|ends in/i.test(text(own));
    const formats: BuyingFormat[] = isAuction ? ["auction"] : ["buy_it_now"];
    if (!isAuction && /make an offer|best offer|offers? accepted/i.test(text(own))) formats.push("best_offer");

    byId.set(id, {
      source: "mycardpost",
      external_id: id,
      title,
      url: `${BASE}${path}`,
      image_url: img ? (img.startsWith("http") ? img : `${BASE}${img.startsWith("/") ? "" : "/"}${img}`) : null,
      price: priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null,
      currency: "USD",
      buying_formats: formats,
      graded: null,
      free_shipping: null,
      location_country: "US",
      listed_at: null,
      ends_at: null,
    });
  });

  return [...byId.values()];
}

export async function fetchMyCardPostListings(
  lastSeenId: number | null,
): Promise<{ listings: ListingInput[]; newestId: number | null; calls: number }> {
  const out: ListingInput[] = [];
  let newestId = lastSeenId;
  let calls = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? `${BASE}/marketplace` : `${BASE}/marketplace?page=${page}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "GrailioBot/1.0 (+https://searchmeta.vercel.app)",
        Accept: "text/html",
      },
    });
    calls++;
    if (!res.ok) throw new Error(`MyCardPost error ${res.status}`);
    const listings = parseMarketplacePage(await res.text());
    if (listings.length === 0) break;

    let reachedSeen = false;
    for (const l of listings) {
      const id = Number(l.external_id);
      if (lastSeenId != null && id <= lastSeenId) {
        reachedSeen = true;
        continue;
      }
      out.push(l);
      if (newestId == null || id > newestId) newestId = id;
    }
    // First run: one page is enough to set the starting point.
    if (reachedSeen || lastSeenId == null) break;
  }
  return { listings: out, newestId, calls };
}
