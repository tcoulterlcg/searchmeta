import type { ListingInput } from "../types";

/**
 * Sotheby's sports & collectibles reader.
 * Reads the public "Sneakers, Sports Memorabilia & Modern Collectibles" department page
 * (lists upcoming auctions + Buy Now items), then a couple of auction pages per run,
 * rotating through them. Honors robots.txt: no /bsp-api/, 15s between requests.
 */

const BASE = "https://www.sothebys.com";
const DEPT = `${BASE}/en/departments/sneakers-collectibles`;
const CRAWL_DELAY_MS = 15_000;
const AUCTIONS_PER_RUN = 2;
const UA = "SearchMetaBot/1.0 (+https://searchmeta.vercel.app)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
const text = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const titleFromSlug = (slug: string) =>
  slug.replace(/^_/, "").replace(/-[0-9a-f]{4}$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

async function get(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!res.ok) throw new Error(`Sotheby's ${res.status} for ${url}`);
  return res.text();
}

interface Found {
  path: string;
  title: string;
  image: string | null;
}

/** Collects links matching a path pattern, with best link text and nearby image. */
export function collectLinks(html: string, pathRe: RegExp): Found[] {
  const out = new Map<string, Found>();
  const aRe = /<a\b[^>]*href=["']((?:https?:\/\/www\.sothebys\.com)?\/[^"'#?]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = aRe.exec(html))) {
    const path = m[1].replace(/^https?:\/\/www\.sothebys\.com/, "");
    if (!pathRe.test(path)) continue;
    const inner = m[2];
    const t = text(inner);
    const img = inner.match(/<img\b[^>]*(?:data-src|src)=["']([^"']+)["']/i)?.[1] ?? null;
    const prev = out.get(path);
    out.set(path, {
      path,
      title: t.length > (prev?.title.length ?? 0) ? t : prev?.title ?? "",
      image: prev?.image ?? (img ? decode(img) : null),
    });
  }
  return [...out.values()].map((f) => ({
    ...f,
    title: f.title.length >= 6 ? f.title : titleFromSlug(f.path.split("/").pop() ?? ""),
  }));
}

const AUCTION_RE = /^\/en\/buy\/auction\/\d{4}\/[a-z0-9-]+\/?$/;
const BUYNOW_RE = /^\/en\/buy\/_[a-z0-9-]+\/?$/;
const lotRe = (auctionPath: string) => new RegExp(`^${auctionPath.replace(/\/$/, "")}/[a-z0-9-]+/?$`);

function toListing(f: Found, kind: "auction" | "buy_now"): ListingInput {
  return {
    source: "sothebys",
    external_id: f.path,
    title: f.title,
    url: `${BASE}${f.path}`,
    image_url: f.image && f.image.startsWith("http") ? f.image : null,
    price: null,
    currency: "USD",
    buying_formats: kind === "auction" ? ["auction"] : ["buy_it_now"],
    graded: null,
    free_shipping: null,
    location_country: null,
    listed_at: null,
    ends_at: null,
  };
}

export async function fetchSothebysListings(
  cursor: number,
): Promise<{ listings: ListingInput[]; nextCursor: number; calls: number; auctions: number }> {
  const deptHtml = await get(DEPT);
  let calls = 1;

  const auctions = collectLinks(deptHtml, AUCTION_RE).map((a) => a.path);
  const listings: ListingInput[] = collectLinks(deptHtml, BUYNOW_RE).map((f) => toListing(f, "buy_now"));

  const start = auctions.length ? cursor % auctions.length : 0;
  const batch = auctions.length
    ? Array.from({ length: Math.min(AUCTIONS_PER_RUN, auctions.length) }, (_, i) => auctions[(start + i) % auctions.length])
    : [];

  for (const path of batch) {
    await sleep(CRAWL_DELAY_MS);
    const html = await get(`${BASE}${path}`);
    calls++;
    listings.push(...collectLinks(html, lotRe(path)).map((f) => toListing(f, "auction")));
  }

  const byId = new Map(listings.map((l) => [l.external_id, l]));
  return { listings: [...byId.values()], nextCursor: start + batch.length, calls, auctions: auctions.length };
}
