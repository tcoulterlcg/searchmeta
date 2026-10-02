"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/Logo";

/** Reached from the password-reset email, already signed in by the link. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setMsg(error.message);
      setBusy(false);
    } else router.replace("/alerts");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <div className="mb-8">
        <Wordmark />
      </div>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input className="input" type="password" required minLength={8} autoComplete="new-password"
          placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? "…" : "Save password"}</button>
      </form>
      {msg && <p className="mt-4 text-sm text-warn">{msg}</p>}
    </main>
  );
}
