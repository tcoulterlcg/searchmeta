"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "./actions";

/** Two steps so nobody deletes their account with a stray tap. */
export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button type="button" className="w-full text-center text-sm font-medium text-red-500 hover:text-red-400"
        onClick={() => setConfirming(true)}>
        Delete account
      </button>
    );
  }
  return (
    <section className="rounded-xl border border-red-500/40 bg-panel p-4">
      <p className="text-sm font-semibold">Delete your account?</p>
      <p className="mt-1 text-sm text-muted">Your saved searches and alerts are removed for good. This can&apos;t be undone.</p>
      <div className="mt-3 flex gap-3">
        <button type="button" disabled={pending}
          className="btn flex-1 bg-red-600 text-white hover:bg-red-500"
          onClick={() => start(async () => {
            const res = await deleteAccount();
            if (res?.error) setError(res.error);
          })}>
          {pending ? "Deleting…" : "Yes, delete it"}
        </button>
        <button type="button" className="btn-ghost flex-1" disabled={pending} onClick={() => setConfirming(false)}>Cancel</button>
      </div>
      {error && <p className="mt-3 text-sm text-warn">{error}</p>}
    </section>
  );
}
