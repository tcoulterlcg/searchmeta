import Link from "next/link";
import { SOURCES, type SavedSearch } from "@/lib/types";
import { NotifyToggle } from "./NotifyToggle";
import { DeleteSearch } from "./DeleteSearch";

export interface SearchStats {
  matches: number;
  lastMatchAt: string | null;
}

/** One saved search: what it looks for on top, what it has found and the actions underneath. */
export function SearchCard({ search: s, stats }: { search: SavedSearch; stats?: SearchStats }) {
  // The name defaults to the keywords, so only show the keywords when they say something extra.
  const showKeywords = s.keywords.trim().toLowerCase() !== s.name.trim().toLowerCase();
  return (
    <li className="rounded-xl border border-line bg-panel">
      <div className="flex items-start justify-between gap-4 p-4 pb-3">
        <Link href={`/searches/${s.id}`} className="min-w-0 flex-1">
          <div className={`truncate font-semibold ${s.notify ? "" : "text-muted"}`}>{s.name}</div>
          {showKeywords && <div className="mt-0.5 truncate text-sm text-muted">{s.keywords}</div>}
          <div className="mt-1.5 text-xs text-muted">{summary(s).join(" · ")}</div>
        </Link>
        <NotifyToggle id={s.id} initial={s.notify} />
      </div>
      <div className="flex min-h-11 items-center justify-between gap-3 border-t border-line px-4 py-1.5 text-sm">
        {stats && stats.matches > 0 ? (
          <Link href={`/alerts?search=${s.id}`} className="min-w-0 truncate hover:text-signal">
            <span className="font-semibold">
              {stats.matches.toLocaleString("en-US")} {stats.matches === 1 ? "match" : "matches"}
            </span>
            {stats.lastMatchAt && <span className="text-muted"> · last {ago(stats.lastMatchAt)}</span>}
          </Link>
        ) : (
          <span className="truncate text-muted">No matches yet</span>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <Link href={`/searches/${s.id}`} aria-label={`Edit ${s.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-ink hover:text-text">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 20h4L19 9l-4-4L4 16v4Zm9.5-13.5 4 4" />
            </svg>
          </Link>
          <DeleteSearch id={s.id} name={s.name} />
        </div>
      </div>
    </li>
  );
}

function summary(s: SavedSearch): string[] {
  const out: string[] = [];
  out.push(
    // Heritage is set up separately in Settings, so it doesn't count toward "all".
    SOURCES.every((x) => x.id === "heritage" || s.sources.includes(x.id))
      ? "All sites"
      : s.sources.length <= 2
        ? s.sources.map((id) => SOURCES.find((x) => x.id === id)?.name).join(", ")
        : `${s.sources.length} sites`,
  );
  if (s.min_price != null || s.max_price != null) {
    out.push(`$${s.min_price ?? 0}–${s.max_price != null ? `$${s.max_price}` : "any"}`);
  }
  if (s.buying_formats.length) {
    out.push(s.buying_formats.map((f) => ({ auction: "Auction", buy_it_now: "Buy It Now", best_offer: "Best Offer" })[f]).join(" / "));
  }
  if (s.condition !== "any") out.push(s.condition === "graded" ? "Graded" : "Ungraded");
  if (s.free_shipping) out.push("Free shipping");
  if (s.located_in) out.push("US only");
  if (s.notify) out.push(s.delivery === "feed" ? "Daily feed" : "Instant");
  return out;
}

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
