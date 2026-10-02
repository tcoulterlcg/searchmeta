import type { BuyingFormat, ListingInput, SaleInput } from "../types";
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

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Finds a date written as "Oct 1, 2026", "10/01/2026" or "2026-10-01" and returns it as ISO. */
export function findDate(s: string): string | null {
  const named = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (named) return iso(Number(named[3]), MONTHS.indexOf(named[1].toLowerCase()) + 1, Number(named[2]));
  const slashed = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashed) return iso(Number(slashed[3]), Number(slashed[1]), Number(slashed[2]));
  const dashed = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (dashed) return iso(Number(dashed[1]), Number(dashed[2]), Number(dashed[3]));
  return null;
}
function iso(y: number, m: number, d: number) {
  const t = Date.UTC(y, m - 1, d, 12);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Sold slabs on one page of the public sold archive. */
export function parseMySlabsSold(html: string): { sales: SaleInput[]; firstText: string } {
  const sales: SaleInput[] = [];
  let firstText = "";
  for (const chunk of html.split(/<div\s+class="slab_item\b/).slice(1)) {
    const body = chunk.split("application/ld+json")[0];
    if (!firstText) firstText = text(body).slice(0, 400);
    const id = body.match(/\/slab\/view\/(\d+)\//)?.[1];
    const title =
      text(body.match(/class="slab-title">([\s\S]*?)<\/div>/)?.[1] ?? "") ||
      decode(body.match(/\balt="([^"]*)"/)?.[1] ?? "").trim();
    if (!id || !title) continue;
    const image = body.match(/data-src="([^"]+)"/)?.[1];
    const plain = text(body);
    sales.push({
      source: "myslabs",
      external_id: id,
      title,
      url: `${BASE}/slab/view/${id}/`,
      image_url: image ? decode(image) : null,
      price: money(body.match(/class="item-price">([\s\S]*?)<\/div>/)?.[1]) ?? money(plain),
      sale_type: "buy_it_now",
      sold_at: findDate(plain.replace(title, "")),
    });
  }
  return { sales, firstText };
}

export async function fetchMySlabsSoldPage(page: number) {
  const html = await (await getHtml(`${BASE}/browse/archive/${page > 1 ? `?page=${page}` : ""}`)).text();
  return parseMySlabsSold(html);
}

/**
 * Copy of the sold archive: walks every page once (oldest pages last), then
 * re-reads the first pages every hour for new sales.
 */
export interface MySlabsSoldState {
  /** Next page to read during the one-time copy. */
  page: number;
  saved: number;
  finishedAt: string | null;
  checkedAt: string | null;
}

export const newMySlabsSold = (): MySlabsSoldState => ({ page: 1, saved: 0, finishedAt: null, checkedAt: null });

const SOLD_PAGES_PER_RUN = 3;
const NEW_SALES_EVERY_MS = 60 * 60 * 1000;

export async function mySlabsSoldStep(
  state: MySlabsSoldState,
  save: (rows: SaleInput[]) => Promise<number>,
  deadline: number,
): Promise<MySlabsSoldState> {
  // New sales appear on page 1. Read forward until a page has nothing we haven't saved.
  if (!state.checkedAt || Date.now() - Date.parse(state.checkedAt) > NEW_SALES_EVERY_MS) {
    for (let page = 1; page <= 5 && Date.now() < deadline; page++) {
      const added = await save((await fetchMySlabsSoldPage(page)).sales);
      state.saved += added;
      if (added === 0) break;
    }
    state.checkedAt = new Date().toISOString();
  }
  for (let i = 0; i < SOLD_PAGES_PER_RUN && !state.finishedAt && Date.now() < deadline; i++) {
    const { sales } = await fetchMySlabsSoldPage(state.page);
    if (sales.length === 0) {
      state.finishedAt = new Date().toISOString();
      break;
    }
    state.saved += await save(sales);
    state.page++;
  }
  return state;
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
