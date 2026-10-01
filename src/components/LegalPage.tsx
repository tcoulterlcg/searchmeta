import Link from "next/link";
import { Wordmark } from "@/components/Logo";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <header className="mb-10 flex items-center justify-between">
        <Wordmark />
        <Link href="/" className="text-sm text-muted hover:text-text">Home</Link>
      </header>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated {updated}</p>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-text/90 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_a]:text-signal [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
