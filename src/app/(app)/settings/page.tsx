import { createClient } from "@/lib/supabase/server";
import { PushSettings } from "./PushSettings";
import { HeritageForwarding } from "./HeritageForwarding";
import { AvatarSettings } from "./AvatarSettings";
import { signOut } from "./actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="rounded-xl border border-line bg-panel p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Account</div>
        <div className="mt-2">{user?.email}</div>
      </section>

      {user?.email && <AvatarSettings email={user.email} initialUrl={profile?.avatar_url ?? null} />}

      <PushSettings />

      <HeritageForwarding />

      <section className="rounded-xl border border-line bg-panel p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Text message alerts</div>
        <p className="mt-2 text-sm text-muted">Coming soon.</p>
      </section>

      <form action={signOut}>
        <button className="btn-ghost w-full">Sign out</button>
      </form>
    </div>
  );
}
