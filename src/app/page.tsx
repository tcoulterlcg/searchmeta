import Link from "next/link";
import { Wordmark } from "@/components/Logo";

const SOURCES = ["eBay", "Goldin", "Fanatics Collect", "MyCardPost"];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <header className="flex items-center justify-between">
        <Wordmark />
        <Link href="/login" className="text-sm text-muted hover:text-text">
          Sign in
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-signal">eBay · Goldin · Fanatics · MyCardPost</p>
        <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          One saved search.
          <br />
          Every auction house.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Tell SearchMeta what you&apos;re hunting for. The moment it&apos;s listed on{" "}
          {SOURCES.join(", ")}, your phone buzzes.
        </p>

        <div className="mt-8 rounded-xl border border-line bg-panel p-4 font-mono text-sm">
          <div className="text-muted">saved search</div>
          <div className="mt-1 text-text">kucherov shield -reprint (psa,bgs)</div>
          <div className="mt-4 flex items-start gap-3 rounded-lg bg-ink p-3 font-sans">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-signal shadow-[0_0_12px_#3ef08a]" />
            <div>
              <div className="text-sm font-semibold">Kucherov Shield · eBay</div>
              <div className="text-sm text-muted">2015 UD The Cup Nikita Kucherov Shield Patch /25 PSA 9 · $1,250</div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Link href="/login?mode=signup" className="btn-primary">
            Start free
          </Link>
          <Link href="/login" className="btn-ghost">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
