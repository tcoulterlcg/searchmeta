"use client";

import { useState, useTransition } from "react";
import { removeSearch } from "./actions";

/** Bin icon on a saved search. Asks once before deleting, so a stray tap can't remove it. */
export function DeleteSearch({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (confirming) {
    return (
      <div className="flex shrink-0 items-center gap-3 text-sm">
        <button type="button" disabled={pending} className="font-semibold text-red-500 hover:text-red-400"
          onClick={() => start(() => removeSearch(id))}>
          {pending ? "Deleting…" : "Delete"}
        </button>
        <button type="button" disabled={pending} className="text-muted hover:text-text" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    );
  }
  return (
    <button type="button" aria-label={`Delete ${name}`} onClick={() => setConfirming(true)}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-ink hover:text-red-500">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v6m4-6v6" />
      </svg>
    </button>
  );
}
