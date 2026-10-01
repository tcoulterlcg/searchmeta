"use client";

import { useEffect, useState } from "react";
import { applyTheme, THEME_KEY, type Theme } from "@/lib/theme";

const OPTIONS: { id: Theme; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "system", label: "Match device" },
];

export function ThemeSettings() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === "light" || t === "system") setTheme(t);
    } catch {}
  }, []);

  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">Appearance</div>
      <div role="radiogroup" aria-label="Theme" className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-line bg-ink p-1">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={theme === o.id}
            onClick={() => {
              setTheme(o.id);
              applyTheme(o.id);
            }}
            className={`rounded-md px-2 py-2 text-sm font-medium transition ${
              theme === o.id ? "bg-panel text-text shadow-sm ring-1 ring-line" : "text-muted hover:text-text"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}
