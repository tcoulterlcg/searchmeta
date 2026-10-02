/* eslint-disable @next/next/no-img-element */
import { createClient } from "@/lib/supabase/server";
import { alertDetails } from "@/lib/ingest";
import { Logo } from "@/components/Logo";
import { SOURCES, type Listing } from "@/lib/types";

/** Shows how a phone alert looks in the App Store app, using your most recent real match. */
export async function AlertPreview() {
  const supabase = await createClient();
  const { data: match } = await supabase
    .from("matches")
    .select("listing:listings!inner(*), saved_search:saved_searches(name)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ listing: Listing; saved_search: { name: string } | null }>();

  const listing = match?.listing;
  const site = listing ? SOURCES.find((s) => s.id === listing.source)?.name ?? "Grailio" : "Fanatics Collect";
  const search = match?.saved_search?.name ?? "Game Used Patch";
  const title = listing?.title ?? "2017 Panini Flawless Chris Webber GAME USED PATCH /25 #49 BGS 9 MINT";
  const details = listing ? alertDetails(listing) : "$1,139 · Buy It Now";

  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">Alert preview</div>

      {/* A phone lock-screen notification. */}
      <div className="mt-3 flex items-start gap-3 rounded-2xl bg-neutral-800/90 p-3 text-white shadow-lg">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[#0b0d10] text-[#e8ecf1]">
          <Logo size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="truncate text-[13px] font-semibold">
              <span className="text-signal">{site}</span> · {search}
            </div>
            <div className="shrink-0 text-[11px] text-white/50">now</div>
          </div>
          <div className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-white/90">{title}</div>
          {details && <div className="mt-0.5 text-[13px] font-medium text-white/70">{details}</div>}
        </div>
        {listing?.image_url && (
          <img src={listing.image_url} alt="" className="h-12 w-9 shrink-0 rounded-md object-cover" />
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        This is how an alert will look in the App Store app. From the Home Screen version an iPhone shows the same words, but
        Apple leaves out the card photo and the colour, so the green there is a 🟢 before the site name. Tap{" "}
        <b className="text-text">Send test</b> above to get your latest match as a real alert.
      </p>
    </section>
  );
}
