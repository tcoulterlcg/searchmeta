import { Wordmark } from "@/components/Logo";
import { ProfileMenu } from "@/components/ProfileMenu";
import { TabBar } from "@/components/TabBar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-ink/90 px-5 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur">
        <Wordmark />
        {user?.email && <ProfileMenu email={user.email} avatarUrl={profile?.avatar_url ?? null} />}
      </header>
      <main className="px-5 py-5">{children}</main>
      <TabBar />
    </div>
  );
}
