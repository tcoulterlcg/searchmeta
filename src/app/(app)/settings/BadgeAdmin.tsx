"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BADGES, BadgePill, badgeLabel, type Badge } from "@/components/Badges";
import { setBadge } from "./actions";

/** Owner only: give or remove profile badges by sign-in email. */
export function BadgeAdmin({ rows }: { rows: { email: string; badge: Badge }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [badge, setBadgeChoice] = useState<Badge>("alpha");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (address: string, which: Badge, on: boolean) =>
    start(async () => {
      const res = await setBadge(address, which, on);
      setError(res.ok ? null : res.error ?? "Something went wrong");
      if (res.ok) {
        if (on) setEmail("");
        router.refresh();
      }
    });

  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">Badges</div>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(email, badge, true);
        }}
      >
        <input
          className="input min-w-0 flex-1 basis-48"
          type="email"
          required
          placeholder="Their sign-in email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          className="input w-auto"
          aria-label="Badge"
          value={badge}
          onChange={(e) => setBadgeChoice(e.target.value as Badge)}
        >
          {BADGES.map((b) => <option key={b} value={b}>{badgeLabel(b)}</option>)}
        </select>
        <button className="btn-primary" disabled={pending}>Give badge</button>
      </form>
      {error && <p className="mt-3 text-sm text-warn">{error}</p>}

      {rows.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {rows.map((r) => (
            <li key={`${r.email}:${r.badge}`} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{r.email}</span>
              <BadgePill badge={r.badge} />
              <button
                type="button"
                disabled={pending}
                className="text-sm text-muted hover:text-red-500"
                onClick={() => run(r.email, r.badge, false)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
