import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SOURCES, type Match } from "@/lib/types";
import { EnablePushBanner } from "@/components/EnablePush";

export default async function AlertsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select("id, saved_search_id, label, listing_id, created_at, seen, listing:listings(*), saved_search:saved_searches(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  const matches = (data ?? []) as unknown as Match[];

  const unseen = matches.filter((m) => !m.seen).map((m) => m.id);
  if (unseen.length) await supabase.from("matches").update({ seen: true }).in("id", unseen);

  return (
    <div>
      <EnablePushBanner />
      <h1 className="mb-5 text-2xl font-bold">Alerts</h1>

      {matches.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-8 text-center">
          <p className="font-semibold">Nothing yet</p>
          <p className="mt-1 text-sm text-muted">New listings that match your saved searches show up here.</p>
          <Link href="/searches/new" className="btn-primary mt-4">Add a search</Link>
        </div>
      )}

      <ul className="space-y-3">
        {matches.map((m) => {
          const l = m.listing;
          if (!l) return null;
          return (
            <li key={m.id}>
              <a href={l.url} target="_blank" rel="noopener noreferrer"
                className="flex gap-3 rounded-xl border border-line bg-panel p-3 transition hover:border-signal-dim">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-ink">
                  {l.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    {!m.seen && <span className="h-2 w-2 rounded-full bg-signal" />}
                    <span className="font-semibold text-signal">{SOURCES.find((s) => s.id === l.source)?.name}</span>
                    <span className="text-muted">· {m.saved_search?.name ?? m.label}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm font-medium">{l.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    {l.price != null && <span className="font-semibold">${Number(l.price).toLocaleString("en-US")}</span>}
                    <span className="text-muted">{formatFormats(l.buying_formats)}</span>
                    <span className="ml-auto text-xs text-muted">{ago(m.created_at)}</span>
                  </div>
                </div>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatFormats(f: string[]) {
  if (f.includes("auction")) return "Auction";
  if (f.includes("buy_it_now")) return f.includes("best_offer") ? "Buy It Now / Offer" : "Buy It Now";
  return "";
}

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
