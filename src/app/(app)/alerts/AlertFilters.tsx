"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Dropdown } from "@/components/Dropdown";

const SORTS = [
  { value: "", label: "Newest" },
  { value: "price_asc", label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
  { value: "ending", label: "Ending soonest" },
];

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

  const active = params.get("q") || params.get("search") || params.get("site") || params.get("sort") || params.get("starred");

  return (
    <div className={`relative z-[5] mb-5 space-y-3 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <input
        className="input"
        type="search"
        placeholder="Filter by title, player, set, grade…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="flex gap-2">
        <Dropdown
          ariaLabel="Saved search"
          className="min-w-0 flex-1"
          options={[{ value: "", label: "All saved searches" }, ...searches.map((s) => ({ value: s.id, label: s.name }))]}
          value={params.get("search") ?? ""}
          onChange={([v]) => update({ search: v || null })}
        />
        <Dropdown
          ariaLabel="Sort"
          className="w-44 shrink-0"
          align="right"
          options={SORTS}
          value={params.get("sort") ?? ""}
          onChange={([v]) => update({ sort: v || null })}
        />
      </div>

      <div className="flex items-center gap-2">
        <Dropdown
          ariaLabel="Sites"
          className="min-w-0 flex-1"
          multiple
          allLabel="All sites"
          unit="sites"
          options={sources.map((s) => ({ value: s.id, label: s.name }))}
          value={selectedSites}
          onChange={(v) => update({ site: v.join(",") || null })}
        />
        <button
          type="button"
          aria-pressed={Boolean(params.get("starred"))}
          onClick={() => update({ starred: params.get("starred") ? null : "1" })}
          className={`input w-44 shrink-0 cursor-pointer whitespace-nowrap text-left ${params.get("starred") ? "border-signal text-signal" : ""}`}
        >
          ★ Watching
        </button>
      </div>

      <div className="flex justify-end empty:hidden">
        {active && (
          <button
            type="button"
            className="text-sm text-muted hover:text-text"
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
