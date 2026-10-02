import { createClient, createServiceClient } from "@/lib/supabase/server";
import { matchesQuery, parseQuery, prepareText } from "@/lib/query";
import { archiveEnabled, searchSales } from "@/lib/archive";
import { SOURCES } from "@/lib/types";
import { LIVE_SOURCES, searchLive, type LiveListing } from "@/lib/live";
import Link from "next/link";
import { SoldSort } from "./SoldSort";
import { PriceChart } from "./PriceChart";

export const dynamic = "force-dynamic";

interface Sale {
  id: string;
  source: string;
  title: string;
  url: string | null;
  image_url: string | null;
  price: number | null;
  sale_type: string | null;
  sold_at: string | null;
}

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default async function SoldPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; mode?: string }>;
}) {
  const { q = "", sort = "recent", mode: rawMode } = await searchParams;
  const query = q.trim();
  // "live" = for sale right now (the default); "sold" = past sales.
  const mode = rawMode === "sold" ? "sold" : "live";
  const supabase = await createClient();

  if (mode === "live") {
    const { listings, failed } = query
      ? // Auction-house lots are kept in a table only the server can read.
        await searchLive(createServiceClient(), query).catch((e) => {
          console.error("live search failed", e);
          return { listings: [] as LiveListing[], failed: [...LIVE_SOURCES] };
        })
      : { listings: [] as LiveListing[], failed: [] };
    return <LiveResults query={query} sort={sort} listings={listings} failed={failed} />;
  }

  let sales: Sale[] = [];
  if (query) {
    const compiled = parseQuery(query);
    if (archiveEnabled()) {
      const found = await searchSales(query).catch((e) => {
        console.error("archive search failed", e);
        return [] as Sale[];
      });
      sales = found.filter((s) => matchesQuery(compiled, prepareText(s.title)));
    } else {
      // Narrow with the longest required words, then apply the full eBay-style syntax.
      const words = compiled.clauses
        .filter((c) => !c.neg && c.kind === "term" && !c.wildcard)
        .map((c) => (c.kind === "term" ? c.value : ""))
        .sort((a, b) => b.length - a.length)
        .slice(0, 3);
      let dbq = supabase
        .from("sales")
        .select("*")
        .order("sold_at", { ascending: false, nullsFirst: false })
        .limit(3000);
      for (const w of words)
        dbq = dbq.ilike("title", `%${w.replace(/[%_\\]/g, "")}%`);
      const { data } = await dbq;
      sales = ((data ?? []) as Sale[]).filter((s) =>
        matchesQuery(compiled, prepareText(s.title)),
      );
    }
  }

  if (sort === "high") sales.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  if (sort === "low")
    sales.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

  const prices = sales
    .map((s) => Number(s.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  const latest = sales.find((s) => s.price != null && s.sold_at);
  // Every dated, priced sale, for the trend chart.
  const trend = sales
    .filter((s) => s.sold_at && Number(s.price) > 0)
    .map((s) => ({ t: Date.parse(s.sold_at as string), p: Number(s.price) }))
    .filter((x) => Number.isFinite(x.t));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Market</h1>
      <ModeSwitch mode="sold" query={query} />
      <form className="space-y-3" action="/sold">
        <input type="hidden" name="mode" value="sold" />
        <div className="flex gap-2">
          <label htmlFor="sold-q" className="sr-only">
            Search past sales
          </label>
          <input
            id="sold-q"
            name="q"
            className="input"
            defaultValue={query}
            placeholder='kucherov shield "1/1"'
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button className="btn-primary shrink-0">Search</button>
        </div>
        {query && (
          <SoldSort query={query} sort={sort} mode="sold" />
        )}
      </form>

      {!query && (
        <p className="mt-6 text-sm text-muted">
          Search past sales by card. Results come from Goldin (back to 2012),
          Fanatics Collect (back to 2021) and Sirius Sports Cards.
        </p>
      )}

      {query && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Sales", sales.length.toLocaleString("en-US")],
              ["Median", prices.length ? money(median(prices)) : "–"],
              ["High", prices.length ? money(Math.max(...prices)) : "–"],
              ["Last sale", latest ? money(Number(latest.price)) : "–"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-line bg-panel p-3"
              >
                <div className="text-xs text-muted">{label}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <PriceChart points={trend} />

          {sales.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
              No sales found.
            </p>
          ) : (
            <ul className="mt-5 space-y-2">
              {sales.slice(0, 300).map((s) => (
                <li key={s.id}>
                  <a
                    href={s.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-3 rounded-xl border border-line bg-panel p-3 transition hover:border-signal-dim"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ink">
                      {s.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-medium">
                        {s.title}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                        <span className="font-semibold text-signal">
                          {SOURCES.find((x) => x.id === s.source)?.name ??
                            s.source}
                        </span>
                        <span>
                          {s.sale_type === "buy_it_now" ? "Buy It Now" : "Auction"}
                        </span>
                        {s.sold_at && (
                          <span>
                            ·{" "}
                            {new Date(s.sold_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                      {s.price != null ? money(Number(s.price)) : "–"}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {sales.length > 300 && (
            <p className="mt-3 text-center text-xs text-muted">
              Showing 300 of {sales.length.toLocaleString("en-US")}. Add words
              to narrow it down.
            </p>
          )}
        </>
      )}
    </div>
  );
}

const sourceName = (id: string) => SOURCES.find((x) => x.id === id)?.name ?? id;

/** The two ways to search: what is listed now, and what has sold. */
function ModeSwitch({ mode, query }: { mode: "live" | "sold"; query: string }) {
  const tab = (m: "live" | "sold", label: string) => (
    <Link
      href={`/sold?mode=${m}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
      aria-current={mode === m ? "page" : undefined}
      className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition ${
        mode === m ? "bg-signal/10 text-signal" : "text-muted hover:text-text"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="mb-3 flex gap-1 rounded-xl border border-line bg-panel p-1">
      {tab("live", "For sale")}
      {tab("sold", "Sold")}
    </div>
  );
}

function LiveResults({
  query,
  sort,
  listings,
  failed,
}: {
  query: string;
  sort: string;
  listings: LiveListing[];
  failed: string[];
}) {
  const rows = [...listings];
  if (sort === "high") rows.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  else if (sort === "low") rows.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  else rows.sort((a, b) => (b.listed_at ?? "").localeCompare(a.listed_at ?? ""));
  const prices = rows.map((r) => Number(r.price)).filter((n) => Number.isFinite(n) && n > 0);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Market</h1>
      <ModeSwitch mode="live" query={query} />
      <form className="space-y-3" action="/sold">
        <input type="hidden" name="mode" value="live" />
        <div className="flex gap-2">
          <label htmlFor="live-q" className="sr-only">
            Search listings for sale now
          </label>
          <input
            id="live-q"
            name="q"
            className="input"
            defaultValue={query}
            placeholder='kucherov shield "1/1"'
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button className="btn-primary shrink-0">Search</button>
        </div>
        {query && <SoldSort query={query} sort={sort} mode="live" />}
      </form>

      {!query && (
        <p className="mt-6 text-sm text-muted">
          Search what is for sale right now on Goldin, Fanatics Collect and the
          auction houses we read. eBay is In Development.
        </p>
      )}

      {query && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Listings", rows.length.toLocaleString("en-US")],
              ["Low", prices.length ? money(Math.min(...prices)) : "–"],
              ["Median", prices.length ? money(median(prices)) : "–"],
              ["High", prices.length ? money(Math.max(...prices)) : "–"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-panel p-3">
                <div className="text-xs text-muted">{label}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>

          {failed.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              Could not reach {failed.map(sourceName).join(", ")} just now. Results
              from those sites are missing.
            </p>
          )}

          {rows.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
              Nothing listed right now.{" "}
              <Link href="/searches/new" className="text-signal">
                Save a search
              </Link>{" "}
              to be alerted when one appears.
            </p>
          ) : (
            <ul className="mt-5 space-y-2">
              {rows.slice(0, 300).map((l) => (
                <li key={`${l.source}:${l.id}`}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-3 rounded-xl border border-line bg-panel p-3 transition hover:border-signal-dim"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ink">
                      {l.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-medium">{l.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span className="font-semibold text-signal">{sourceName(l.source)}</span>
                        <span>{l.format === "auction" ? "Auction" : "Buy It Now"}</span>
                        {l.ends_at && (
                          <span>
                            · ends{" "}
                            {new Date(l.ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                      {l.price != null ? money(Number(l.price)) : "–"}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {rows.length > 300 && (
            <p className="mt-3 text-center text-xs text-muted">
              Showing 300 of {rows.length.toLocaleString("en-US")}. Add words to narrow it down.
            </p>
          )}
        </>
      )}
    </div>
  );
}
