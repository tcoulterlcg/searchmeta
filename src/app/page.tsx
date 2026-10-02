import Link from "next/link";
import { Wordmark } from "@/components/Logo";

const POINTS = [
  {
    title: "Save it once",
    body: "Type what you collect, the same way you would on eBay. Add a price range or grade if you want.",
  },
  {
    title: "We watch every site",
    body: "Marketplaces and auction houses are checked around the clock, so you don't have to keep a tab open on each.",
  },
  {
    title: "One alert, straight to the listing",
    body: "Get a push the moment it's listed, or one daily feed. Check what it sold for before you bid.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 pt-[max(env(safe-area-inset-top),1.5rem)] sm:px-6">
      <header className="flex items-center justify-between">
        <Wordmark />
        <nav className="flex items-center gap-6 text-[15px] text-muted">
          <Link href="/about" className="hover:text-text">About</Link>
          <Link href="/login" className="hover:text-text">Sign in</Link>
        </nav>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-12 py-14 lg:flex-row lg:items-center lg:gap-14 lg:py-20">
        <div className="min-w-0 flex-[1.25]">
          <p className="mb-4 text-xs font-semibold uppercase leading-relaxed tracking-[0.16em] text-signal">
            Goldin · Fanatics Collect · MyCardPost · MySlabs · and more
          </p>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:whitespace-nowrap sm:text-5xl">
            One saved search.
            <br />
            Every auction house.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            Tell Grailio what you&apos;re hunting for. The moment it&apos;s listed on any site we search, your phone buzzes.{" "}
            <Link href="/about" className="whitespace-nowrap text-signal hover:underline">See every site</Link>
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login?mode=signup" className="btn-primary px-5 py-3 text-[15px]">Start free</Link>
            <Link href="/login" className="btn-ghost px-5 py-3 text-[15px]">Sign in</Link>
          </div>
        </div>

        {/* The whole product in two steps: what you type, and what lands on your phone. */}
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="text-[13px] text-muted">You save a search</div>
          <div className="flex h-[52px] items-center gap-2.5 rounded-xl border border-line bg-panel px-3.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-muted">
              <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4 4" />
            </svg>
            <span className="truncate text-base">kucherov shield -reprint</span>
          </div>
          <div className="flex justify-center py-0.5 text-muted">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14m-6-6 6 6 6-6" />
            </svg>
          </div>
          <div className="text-[13px] text-muted">Your phone gets this</div>
          <div className="flex gap-3 rounded-[14px] border border-signal-dim bg-panel p-3.5">
            {/* Stand-in for the card photo. */}
            <div aria-hidden="true" className="flex h-[88px] w-16 shrink-0 items-end overflow-hidden rounded-lg bg-ink p-1.5">
              <div className="h-1/3 w-full rounded bg-line" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-1.5 text-[13px]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-signal" />
                <span className="font-semibold text-signal">Goldin</span>
                <span className="truncate text-muted">· Kucherov Shield</span>
              </div>
              <div className="text-[15px] font-medium leading-snug">2015 UD The Cup Nikita Kucherov Shield Patch 1/1 BGS 9.5</div>
              <div className="text-[15px]">
                <span className="font-bold">$86,806</span> <span className="text-muted">· Auction</span>{" "}
                <span className="whitespace-nowrap font-semibold text-warn">· Ends in 2d 4h</span>
              </div>
            </div>
          </div>
          <div className="text-[13px] text-muted">Example alert. One tap opens the listing on the seller&apos;s site.</div>
        </div>
      </section>

      <section className="grid gap-8 border-t border-line py-8 pb-12 sm:grid-cols-3">
        {POINTS.map((p) => (
          <div key={p.title}>
            <h2 className="font-semibold">{p.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
          </div>
        ))}
      </section>

      <footer className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line py-6 text-sm text-muted">
        <Link href="/about" className="hover:text-text">About</Link>
        <Link href="/support" className="hover:text-text">Support</Link>
        <Link href="/terms" className="hover:text-text">Terms</Link>
        <Link href="/privacy" className="hover:text-text">Privacy</Link>
      </footer>
    </main>
  );
}
