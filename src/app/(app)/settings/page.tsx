import { createClient } from "@/lib/supabase/server";
import { PushSettings } from "./PushSettings";
import { AlertPreview } from "./AlertPreview";
import { HeritageForwarding } from "./HeritageForwarding";
import { AvatarSettings } from "./AvatarSettings";
import { ThemeSettings } from "./ThemeSettings";
import { signOut } from "./actions";
import { isOwner } from "@/lib/owner";
import { DeleteAccount } from "./DeleteAccount";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
    : { data: null };

  const owner = await isOwner(user?.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="rounded-xl border border-line bg-panel p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Account</div>
        <div className="mt-2">{user?.email}</div>
      </section>

      <PushSettings />

      <AlertPreview />

      <ThemeSettings />

      {user?.email && <AvatarSettings email={user.email} initialUrl={profile?.avatar_url ?? null} />}

      <HeritageForwarding />

      <section className="rounded-xl border border-line bg-panel p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Text message alerts</div>
        <p className="mt-2 text-sm text-muted">In Development</p>
      </section>

      {owner && (
        <section className="rounded-xl border border-line bg-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Backup</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a className="btn-ghost" href="/api/export/searches" download>Saved searches (CSV)</a>
            <a className="btn-ghost" href="/api/export/sales" download>Sold data (CSV)</a>
          </div>
        </section>
      )}

      <form action={signOut}>
        <button className="btn-ghost w-full">Sign out</button>
      </form>

      <DeleteAccount />
    </div>
  );
}
