import type { ListingInput, SaleInput, SourceId } from "../types";
import { decode, getHtml, money, text, UA } from "./html";

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
 * reader to get past that. Move a house into HOUSES once it lets GrailFindrBot in.
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
  return { listings, lots: [] as CatalogLot[], nextCursor: page, calls, parsed, note: "" };
}

/* ---------- "catalog" software ---------- */

/**
 * A lot on a catalog page. `bid` is the bid it currently shows (null when nobody has bid yet).
 * `final` is set once the auction has closed and the page shows what the lot sold for.
 */
export interface CatalogLot {
  listing: ListingInput;
  bid: number | null;
  final: number | null;
}

/** Lots on a catalog page, each with its current bid. */
export function parseCatalogLots(h: House, html: string): CatalogLot[] {
  const ends = html.match(/<title>[^<]*Ends\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  const endsAt = ends
    ? new Date(Date.UTC(Number(ends[3]) + (ends[3].length === 2 ? 2000 : 0), Number(ends[1]) - 1, Number(ends[2]) + 1, 3)).toISOString()
    : null;
  const out: CatalogLot[] = [];
  for (const chunk of html.split(/<div class="lot\s*">/).slice(1)) {
    const link = chunk.match(/<a href='([^']*?([^'\/]+-LOT(\d+)\.aspx))'>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const title = text(link[4]);
    if (!title) continue;
    const img = chunk.match(/<img\b[^>]*?\b(?:data-src|data-original|src)=['"]([^'"]+)['"]/i)?.[1];
    const bid = money(chunk.match(/Current Bid:\s*([^<]*)</i)?.[1]);
    const final = money(chunk.match(/Final Price:\s*([^<]*)</i)?.[1]);
    out.push({
      listing: listing(h, {
        id: link[3],
        title,
        url: `${h.base}/${link[2]}`,
        image: img ? absolute(h.base, decode(img)) : null,
        price: final ?? bid ?? money(chunk.match(/Min Bid:\s*([^<]*)</i)?.[1]),
        endsAt,
      }),
      bid: bid && bid > 0 ? bid : null,
      final: final && final > 0 ? final : null,
    });
  }
  return out;
}

/** Lots on a catalog page. */
export function parseCatalog(h: House, html: string): ListingInput[] {
  return parseCatalogLots(h, html).map((l) => l.listing);
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

interface Dropdown {
  name: string;
  options: { value: string; label: string }[];
}

export function dropdowns(html: string): Dropdown[] {
  return [...html.matchAll(/<select\b[^>]*\bname="([^"]*)"[^>]*>([\s\S]*?)<\/select>/gi)].map((m) => ({
    name: m[1],
    options: [...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map((o) => ({
      value: decode(o[1].match(/\bvalue="([^"]*)"/i)?.[1] ?? text(o[2])),
      label: text(o[2]),
    })),
  }));
}

const isNumber = (s: string) => /^\d+$/.test(s);

/**
 * The "lots per page" dropdown (the page has a copy at the top and the bottom).
 * Returns its choices from largest to smallest: "All" first when offered.
 */
export function lotsPerPageControl(html: string): { names: string[]; values: string[] } | null {
  const found = dropdowns(html).filter((d) => {
    const numbers = d.options.filter((o) => isNumber(o.label)).map((o) => Number(o.label));
    return (
      numbers.length >= 2 &&
      Math.min(...numbers) >= 10 &&
      d.options.every((o) => isNumber(o.label) || /^all$/i.test(o.label))
    );
  });
  if (!found.length) return null;
  const options = found[0].options;
  const all = options.filter((o) => /^all$/i.test(o.label));
  const numeric = options.filter((o) => isNumber(o.label)).sort((a, b) => Number(b.label) - Number(a.label));
  return { names: found.map((d) => d.name), values: [...all, ...numeric.slice(0, 1)].map((o) => o.value) };
}

/** The "Paging: [1] of 20 [Go]" control: the page-number box, its Go button, and how many pages there are. */
export function pageJump(html: string): { box: string; button: { name: string; value: string }; pages: number } | null {
  const inputs = [...html.matchAll(/<input\b[^>]*>/gi)].map((m) => m[0]);
  const name = (tag: string) => tag.match(/\bname="([^"]*)"/i)?.[1] ?? "";
  const box = inputs.find((t) => /CurrPage\w*TB$/i.test(name(t)));
  const button = inputs.find((t) => /PageJumpBtn\w*$/i.test(name(t)));
  if (!box || !button) return null;
  const after = html.slice(html.indexOf(box) + box.length, html.indexOf(box) + box.length + 400);
  const pages = Number(text(after).match(/\bof\s+(\d+)/i)?.[1] ?? 1);
  return { box: name(box), button: { name: name(button), value: decode(button.match(/\bvalue="([^"]*)"/i)?.[1] ?? "Go") }, pages };
}

const CATALOG_BUDGET_MS = 22_000;

async function fetchCatalog(h: House, startPage: number) {
  // Where the catalog lives. Updated if the site redirects us, so later form posts go to the right address.
  let url = `${h.base}/catalog.aspx`;
  const redirects: string[] = [];
  let calls = 0;
  const started = Date.now();

  // The site keeps the chosen page size in a session, so cookies have to carry across requests and redirects.
  const jar = new Map<string, string>();
  const visit = async (target: string, init: RequestInit = {}): Promise<string> => {
    let next = target;
    let request = init;
    for (let hop = 0; hop < 4; hop++) {
      const res = await fetch(next, {
        ...request,
        redirect: "manual",
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
          ...(request.headers ?? {}),
        },
        signal: AbortSignal.timeout(25_000),
      });
      calls++;
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const pair = c.split(";")[0];
        const eq = pair.indexOf("=");
        if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        next = new URL(location, next).toString();
        redirects.push(`${request.method ?? "GET"} ${res.status} -> ${next}`);
        request = {};
        continue;
      }
      if (!res.ok) throw new Error(`${new URL(next).hostname} returned ${res.status}`);
      if (/catalog\.aspx/i.test(next)) url = next;
      return res.text();
    }
    throw new Error("too many redirects");
  };

  let html = await visit(url);
  const byId = new Map<string, ListingInput>();
  const extras = new Map<string, { bid: number | null; final: number | null }>();
  const add = (page: string) => {
    const found = parseCatalogLots(h, page);
    for (const l of found) {
      byId.set(l.listing.external_id, l.listing);
      extras.set(l.listing.external_id, { bid: l.bid, final: l.final });
    }
    return found.length;
  };
  const firstCount = add(html);

  // Shown only in test reads, to see how a house's page is laid out.
  let note =
    `first page ${firstCount}; dropdowns: ` +
    dropdowns(html)
      .map((d) => `${d.name.split("$").pop()}(${d.options.length}: ${d.options[0]?.label}..${d.options.at(-1)?.label})`)
      .join(", ") +
    `; forms: ${[...html.matchAll(/<form\b[^>]*>/gi)].map((m) => m[0].slice(0, 120)).join(" ")}` +
    `; hidden: ${[...html.matchAll(/<input\b[^>]*type="hidden"[^>]*>/gi)].map((m) => `${m[0].match(/\bname="([^"]*)"/i)?.[1]}(${(m[0].match(/\bvalue="([^"]*)"/i)?.[1] ?? "").length})`).join(",").slice(0, 300)}`;
  let nextCursor = 1;

  /** Changes a dropdown the way the browser does and returns the page that comes back. */
  const choose = async (names: string[], value: string) => {
    const form = formFields(html);
    form.set("__EVENTTARGET", names[0]);
    form.set("__EVENTARGUMENT", "");
    for (const n of names) form.set(n, value);
    return visit(url, {
      method: "POST",
      body: form.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: url },
    });
  };

  try {
    // The page shows 25 lots at a time. Ask for all of them, or failing that the most it offers.
    const size = lotsPerPageControl(html);
    if (size && firstCount >= 20) {
      for (const value of size.values) {
        const page = await choose(size.names, value);
        const n = parseCatalog(h, page).length;
        note += `; per-page=${value} returned ${n}`;
        if (n > firstCount) {
          html = page;
          add(page);
          break;
        }
      }
    }
    // Then walk the remaining pages with the "go to page" box, picking up where the last run stopped.
    let jump = pageJump(html);
    note += `; pages ${jump?.pages ?? 1}`;
    let page = jump && startPage > 1 && startPage <= jump.pages ? startPage : 2;
    while (jump && page <= jump.pages) {
      if (Date.now() - started > CATALOG_BUDGET_MS) {
        nextCursor = page;
        break;
      }
      const form = formFields(html);
      form.set("__EVENTTARGET", "");
      form.set("__EVENTARGUMENT", "");
      form.set(jump.box, String(page));
      form.set(jump.button.name, jump.button.value);
      const before = byId.size;
      html = await visit(url, {
        method: "POST",
        body: form.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: url },
      });
      const n = add(html);
      note += `; p${page}=${n}`;
      if (n === 0 || byId.size === before) break;
      jump = pageJump(html) ?? jump;
      page++;
    }
  } catch (e) {
    // Keep what was read if a later page can't be loaded.
    note += `; stopped: ${e instanceof Error ? e.message : String(e)}`;
  }
  note += `; redirects: ${redirects.join(" | ") || "none"}`;
  const lots: CatalogLot[] = [...byId.values()].map((l) => ({ listing: l, bid: null, final: null, ...extras.get(l.external_id) }));
  // Lots that have already sold are kept for the sold archive but are not offered as listings.
  return { listings: lots.filter((l) => l.final == null).map((l) => l.listing), lots, nextCursor, calls, parsed: byId.size, note: note.slice(-900) };
}

/* ---------- past results ("catalog" software) ---------- */

/** A browser-like visit to one of these sites: keeps cookies, follows redirects, and can submit the page's form. */
function aspSession(startUrl: string) {
  const jar = new Map<string, string>();
  let url = startUrl;
  let calls = 0;
  const visit = async (target: string, init: RequestInit = {}): Promise<string> => {
    let next = target;
    let request = init;
    for (let hop = 0; hop < 4; hop++) {
      const res = await fetch(next, {
        ...request,
        redirect: "manual",
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
          ...(request.headers ?? {}),
        },
        signal: AbortSignal.timeout(25_000),
      });
      calls++;
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const pair = c.split(";")[0];
        const eq = pair.indexOf("=");
        if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        next = new URL(location, next).toString();
        request = {};
        continue;
      }
      if (!res.ok) throw new Error(`${new URL(next).hostname} returned ${res.status}`);
      url = next;
      return res.text();
    }
    throw new Error("too many redirects");
  };
  /** Submits the form on `html` with some fields changed; `target` is the control that "caused" the submit. */
  const submit = (html: string, fields: Record<string, string>, target = "") => {
    const form = formFields(html);
    form.set("__EVENTTARGET", target);
    form.set("__EVENTARGUMENT", "");
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    return visit(url, {
      method: "POST",
      body: form.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: url },
    });
  };
  return { visit, submit, calls: () => calls, url: () => url };
}

/** The "Select Auction" dropdown on the past-results page. */
export function auctionPicker(html: string): Dropdown | null {
  return dropdowns(html).find((d) => d.options.filter((o) => /auction|ends\s+\d/i.test(o.label)).length >= 2) ?? null;
}

/**
 * Houses whose past results we copy. Only Sirius: the other four houses on this software
 * list /AuctionResults.aspx as off limits in their robots.txt.
 */
export const RESULTS_HOUSES = HOUSES.filter((h) => h.id === "sirius");

/** "… Auction # 424 - Ends 9/24/26" -> ISO date (evening US time). */
function endsDate(label: string): string | null {
  const m = label.match(/Ends\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  if (!m) return null;
  const year = Number(m[3]) + (m[3].length === 2 ? 2000 : 0);
  return new Date(Date.UTC(year, Number(m[1]) - 1, Number(m[2]) + 1, 3)).toISOString();
}

/** Every lot in one past auction's results table. Lots with no final price (unsold) are left out. */
export function parseResults(h: House, html: string): SaleInput[] {
  const table = html.slice(html.indexOf('id="SearchGrid"'));
  const sales: SaleInput[] = [];
  for (const row of table.split(/<tr\b[^>]*>/i).slice(2)) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (cells.length < 5) continue;
    const id = cells[2].match(/inventoryid=(\d+)/i)?.[1];
    const title = text(cells[2]);
    const price = money(text(cells[4]));
    if (!id || !title || !price) continue;
    sales.push({
      source: h.id,
      external_id: id,
      title,
      url: `${h.base}/LotDetail.aspx?inventoryid=${id}`,
      image_url: null,
      price,
      sale_type: "auction",
      sold_at: endsDate(text(cells[0])),
    });
  }
  return sales;
}

export interface ResultsState {
  /** Auction ids still to copy, newest first. */
  queue: string[];
  /** Highest auction id seen, so later checks only pick up newer auctions. */
  newest: number;
  listedAt: string | null;
  auctions: number;
  saved: number;
}

export const newResultsState = (): ResultsState => ({ queue: [], newest: 0, listedAt: null, auctions: 0, saved: 0 });

const RELIST_EVERY_MS = 12 * 60 * 60 * 1000;

/**
 * One step of the past-results copy: ONE request per run. Either refreshes the list of
 * past auctions (twice a day) or copies the next auction on the list.
 */
export async function resultsStep(h: House, state: ResultsState, save: (rows: SaleInput[]) => Promise<number>) {
  const page = `${h.base.replace("://www.", "://")}/auctionresults.aspx`;
  if (!state.listedAt || Date.now() - Date.parse(state.listedAt) > RELIST_EVERY_MS) {
    const html = await (await getHtml(page)).text();
    const ids = (auctionPicker(html)?.options ?? [])
      .map((o) => Number(o.value))
      .filter((n) => Number.isInteger(n) && n > state.newest)
      .sort((a, b) => b - a);
    state.queue.push(...ids.map(String));
    if (ids.length) state.newest = ids[0];
    state.listedAt = new Date().toISOString();
    return state;
  }
  const id = state.queue[0];
  if (!id) return state;
  const html = await (await getHtml(`${page}?auctionid=${id}`)).text();
  state.saved += await save(parseResults(h, html));
  state.auctions++;
  state.queue.shift();
  return state;
}

/** Test read of a house's past-results page, to see how it is laid out. Saves nothing. */
export async function probeResults(h: House) {
  const s = aspSession(`${h.base}/auctionresults.aspx`);
  let html = await s.visit(s.url());
  const picker = auctionPicker(html);
  const out: Record<string, unknown> = {
    dropdowns: dropdowns(html).map((d) => `${d.name}(${d.options.length}): ${d.options.slice(0, 3).map((o) => `${o.label}=${o.value}`).join(" | ")} ... ${d.options.at(-1)?.label}`),
    lotsBefore: parseCatalog(h, html).length,
  };
  if (picker) {
    const choice = picker.options.find((o) => /ends\s+\d/i.test(o.label));
    if (choice) {
      html = await s.submit(html, { [picker.name]: choice.value }, picker.name);
      const buttons = [...html.matchAll(/<input\b[^>]*type="(?:submit|image|button)"[^>]*>/gi)].map((m) => ({
        name: m[0].match(/\bname="([^"]*)"/i)?.[1] ?? "",
        value: decode(m[0].match(/\bvalue="([^"]*)"/i)?.[1] ?? ""),
      }));
      out.buttons = buttons.map((b) => `${b.name}=${b.value}`);
      out.resultLinks = [...new Set([...html.matchAll(/href=['"]([^'"#]+)['"]/g)].map((m) => m[1].replace(/\d+/g, "N")))].filter((l) => /result|auctionid|price/i.test(l)).slice(0, 10);
      const search = buttons.find((b) => /search/i.test(b.name) && !/reset/i.test(b.name));
      if (parseCatalog(h, html).length === 0 && search) {
        html = await s.submit(html, { [picker.name]: choice.value, [search.name]: search.value });
        out.pressed = search.name;
      }
      const at = html.search(/-LOT\d+\.aspx/i);
      Object.assign(out, {
        chose: choice.label,
        lotsAfter: parseCatalog(h, html).length,
        sample: parseCatalog(h, html).slice(0, 2),
        raw: at >= 0 ? html.slice(Math.max(0, at - 700), at + 1500).replace(/\s+/g, " ") : text(html).slice(0, 600),
        perPage: lotsPerPageControl(html),
        jump: pageJump(html),
        dropdownsAfter: dropdowns(html).map((d) => `${d.name.split("$").pop()}(${d.options.length})`),
      });
    }
  }
  out.calls = s.calls();
  out.url = s.url();
  return out;
}

export async function fetchHouseListings(h: House, cursor: number) {
  return h.platform === "gallery" ? fetchGallery(h, cursor) : fetchCatalog(h, cursor);
}
