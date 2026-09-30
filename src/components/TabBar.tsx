"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/alerts", label: "Alerts", icon: "M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6Zm-2 16a2 2 0 0 0 4 0" },
  { href: "/searches", label: "Searches", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4 4" },
  { href: "/settings", label: "Settings", icon: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0-6v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active ? "text-signal" : "text-muted"}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
