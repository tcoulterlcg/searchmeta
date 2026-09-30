import { Wordmark } from "@/components/Logo";
import { TabBar } from "@/components/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-24">
      <header className="sticky top-0 z-10 border-b border-line bg-ink/90 px-5 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur">
        <Wordmark />
      </header>
      <main className="px-5 py-5">{children}</main>
      <TabBar />
    </div>
  );
}
