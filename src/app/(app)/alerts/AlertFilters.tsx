"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/** More sites than this won't fit on one row, so they move into a dropdown. */
const MAX_CHIPS = 6;

interface Props {
  searches: { id: string; name: string }[];
  sources: { id: string; name: string }[];
}

export function AlertFilters({ searches, sources }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const selectedSites = (params.get("site") ?? "").split(",").filter(Boolean);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.replace(`/alerts${next.toString() ? `?${next}` : ""}`, { scroll: false }));
  }

  // Debounce typing in the search box.
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function toggleSite(id: string) {
    const set = new Set(selectedSites);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    update({ site: [...set].join(",") || null });
  }

  const active = params.get("q") || params.get("search") || params.get("site") || params.get("sort") || params.get("starred");

  return (
    <div className={`mb-5 space-y-3 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <input
        className="input"
        type="search"
        placeholder="Filter by title, player, set, grade…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="flex gap-2">
        <select
          className="input flex-1"
          value={params.get("search") ?? ""}
          onChange={(e) => update({ search: e.target.value || null })}
        >
          <option value="">All saved searches</option>
          {searches.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={params.get("sort") ?? ""}
          onChange={(e) => update({ sort: e.target.value || null })}
        >
          <option value="">Newest</option>
          <option value="price_asc">Price: low → high</option>
          <option value="price_desc">Price: high → low</option>
          <option value="ending">Ending soonest</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {sources.length > MAX_CHIPS ? (
          // Too many sites for one row of chips: pick them from a dropdown instead.
          <details className="relative">
            <summary className={`chip list-none [&::-webkit-details-marker]:hidden ${selectedSites.length ? "border-signal bg-signal/10 text-signal" : ""}`}>
              {selectedSites.length === 0
                ? "All sites"
                : selectedSites.length === 1
                  ? sources.find((s) => s.id === selectedSites[0])?.name ?? "1 site"
                  : `${selectedSites.length} sites`}
              <span className="ml-1.5 text-xs">▾</span>
            </summary>
            <div className="absolute left-0 z-20 mt-2 max-h-80 w-64 overflow-auto rounded-xl border border-line bg-panel p-1.5 shadow-xl">
              {sources.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-ink">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-signal"
                    checked={selectedSites.includes(s.id)}
                    onChange={() => toggleSite(s.id)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </details>
        ) : (
          sources.map((s) => {
            const on = selectedSites.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSite(s.id)}
                className={`chip ${on ? "border-signal bg-signal/10 text-signal" : ""}`}
              >
                {s.name}
              </button>
            );
          })
        )}
        <button
          type="button"
          aria-pressed={Boolean(params.get("starred"))}
          onClick={() => update({ starred: params.get("starred") ? null : "1" })}
          className={`chip ${params.get("starred") ? "border-signal bg-signal/10 text-signal" : ""}`}
        >
          ★ Starred
        </button>
        {active && (
          <button
            type="button"
            className="ml-auto text-sm text-muted hover:text-text"
            onClick={() => {
              setQ("");
              start(() => router.replace("/alerts", { scroll: false }));
            }}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
