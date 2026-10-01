"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(app)/settings/actions";
import { Avatar } from "@/components/Avatar";

/** Avatar button in the header: shows the account and a quick sign-out. */
export function ProfileMenu({ email, avatarUrl }: { email: string; avatarUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded-full transition hover:opacity-80"
      >
        <Avatar email={email} url={avatarUrl} size={36} />
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-64 overflow-hidden rounded-xl border border-line bg-panel shadow-2xl shadow-black/50">
          <div className="border-b border-line px-4 py-3">
            <div className="text-xs text-muted">Signed in as</div>
            <div className="truncate text-sm font-medium">{email}</div>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm hover:bg-ink"
          >
            Account &amp; settings
          </Link>
          <form action={signOut}>
            <button type="submit" className="w-full border-t border-line px-4 py-3 text-left text-sm text-red-400 hover:bg-ink">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
