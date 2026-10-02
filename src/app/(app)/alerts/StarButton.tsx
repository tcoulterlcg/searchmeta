"use client";

import { useState, useTransition } from "react";
import { setStarred } from "./actions";

export function StarButton({ id, initial }: { id: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={on ? "Remove star" : "Star this listing"}
      aria-pressed={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        start(() => setStarred(id, next));
      }}
      className={`flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-lg transition hover:bg-ink ${on ? "text-signal" : "text-muted"}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />
      </svg>
    </button>
  );
}
