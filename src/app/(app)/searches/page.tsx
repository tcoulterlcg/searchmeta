import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SOURCES, type SavedSearch } from "@/lib/types";
import { NotifyToggle } from "./NotifyToggle";
import { DeleteSearch } from "./DeleteSearch";

export default async function SearchesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("saved_searches").select("*").order("created_at", { ascending: false });
  const searches = (data ?? []) as SavedSearch[];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Saved searches</h1>
        <Link href="/searches/new" className="btn-primary">+ New</Link>
      </div>

      {searches.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-8 text-center">
          <p className="font-semibold">No saved searches yet</p>
          <p className="mt-1 text-sm text-muted">Save a search and we&apos;ll watch every auction house for it.</p>
          <Link href="/searches/new" className="btn-primary mt-4">Create your first search</Link>
        </div>
      )}

      <ul className="space-y-3">
        {searches.map((s) => (
          <li key={s.id} className="rounded-xl border border-line bg-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/searches/${s.id}`} className="min-w-0 flex-1">
                <div className="truncate font-semibold">{s.name}</div>
                <div className="mt-0.5 truncate font-mono text-sm text-muted">{s.keywords}</div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">
                  {summary(s).map((t) => (
                    <span key={t} className="rounded bg-ink px-2 py-0.5">{t}</span>
                  ))}
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-3">
                <DeleteSearch id={s.id} name={s.name} />
                <NotifyToggle id={s.id} initial={s.notify} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function summary(s: SavedSearch): string[] {
  const out: string[] = [];
  out.push(
    // Heritage is set up separately in Settings, so it doesn't count toward "all".
    SOURCES.every((x) => x.id === "heritage" || s.sources.includes(x.id))
      ? "All sites"
      : s.sources.map((id) => SOURCES.find((x) => x.id === id)?.name).join(", "),
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
