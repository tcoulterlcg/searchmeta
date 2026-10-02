"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/Logo";

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(
    params.get("reset") === "expired" ? "That reset link has expired or was opened in a different browser. Request a new one." : null,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    if (mode === "forgot") {
      // Remembered for an hour so the emailed link opens "choose a new password".
      document.cookie = "sm_recovery=1; path=/; max-age=3600; samesite=lax";
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      setMsg(error ? error.message : "Check your email for a link to reset your password. Open it in this browser.");
    } else if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("Check your email to confirm your account.");
      else router.replace("/searches");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
      else router.replace("/alerts");
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <div className="mb-8">
        <Wordmark />
      </div>
      <h1 className="text-2xl font-bold">{mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back"}</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input className="input" type="email" required autoComplete="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode !== "forgot" && (
          <input className="input" type="password" required minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="Password"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Email me a reset link" : "Sign in"}
        </button>
      </form>
      {msg && <p className="mt-4 text-sm text-warn">{msg}</p>}
      {mode === "signin" && (
        <button className="mt-4 text-left text-sm text-muted hover:text-text"
          onClick={() => { setMode("forgot"); setMsg(null); }}>
          Forgot password?
        </button>
      )}
      <button className="mt-4 text-left text-sm text-muted hover:text-text"
        onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}>
        {mode === "signin" ? "New here? Create an account" : mode === "forgot" ? "Back to sign in" : "Already have an account? Sign in"}
      </button>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
