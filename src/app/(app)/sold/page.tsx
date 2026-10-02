import { createClient, createServiceClient } from "@/lib/supabase/server";
import { matchesQuery, parseQuery, prepareText } from "@/lib/query";
import { fetchFanaticsSold } from "@/lib/sources/fanatics";
import { fetchGoldinSold } from "@/lib/sources/goldin";
import type { SaleInput } from "@/lib/types";
import { archiveEnabled, saveSales, searchSales } from "@/lib/archive";
import { SOURCES } from "@/lib/types";
import { SoldSort } from "./SoldSort";

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

/** Pulls fresh results from the sources for this search and saves them to our archive. */
async function refreshArchive(q: string) {
  const db = createServiceClient();
  const results = await Promise.allSettled([
    fetchFanaticsSold(q),
    fetchGoldinSold(q),
  ]);
  const rows: SaleInput[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") rows.push(...r.value);
    else console.error("sold refresh failed", r.reason);
  }
  if (archiveEnabled()) {
    await saveSales(rows).catch((e) => console.error("archive save failed", e));
    return;
  }
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .from("sales")
      .upsert(rows.slice(i, i + 500), {
        onConflict: "source,external_id",
        ignoreDuplicates: true,
      });
  }
}

export default async function SoldPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { q = "", sort = "recent" } = await searchParams;
  const query = q.trim();
  const supabase = await createClient();

  let sales: Sale[] = [];
  if (query) {
    await refreshArchive(query);

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

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Sold</h1>
      <form className="space-y-3" action="/sold">
        <div className="flex gap-2">
          <label htmlFor="sold-q" className="sr-only">
            Search past sales
          </label>
          <input
            id="sold-q"
            name="q"
            className="input font-mono"
            defaultValue={query}
            placeholder='kucherov shield "1/1"'
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button className="btn-primary shrink-0">Search</button>
        </div>
        {query && (
          <SoldSort query={query} sort={sort} />
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
