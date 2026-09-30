"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/Logo";

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    if (mode === "signup") {
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
      <h1 className="text-2xl font-bold">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input className="input" type="email" required autoComplete="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" required minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
      {msg && <p className="mt-4 text-sm text-warn">{msg}</p>}
      <button className="mt-6 text-sm text-muted hover:text-text"
        onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
        {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
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
