"use client";

import { useState, useTransition } from "react";
import { toggleNotify } from "./actions";

export function NotifyToggle({ id, initial }: { id: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-2">
      <span className="text-xs text-muted">{on ? "Alerts on" : "Paused"}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Alerts for this search"
        disabled={pending}
        onClick={() => {
          const next = !on;
          setOn(next);
          start(() => toggleNotify(id, next));
        }}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-signal" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}
