import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { ProfileMenu } from "@/components/ProfileMenu";
import { TabBar } from "@/components/TabBar";
import { createClient } from "@/lib/supabase/server";
import { getBadges } from "@/lib/badges";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
    : { data: null };
  const badges = await getBadges(user?.email);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-ink/90 px-5 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur">
        <Wordmark />
        <div className="flex items-center gap-4">
          <Link href="/about" className="text-sm text-muted hover:text-text">About</Link>
          {user?.email && <ProfileMenu email={user.email} avatarUrl={profile?.avatar_url ?? null} badges={badges} />}
        </div>
      </header>
      <main className="px-5 py-5">{children}</main>
      <TabBar />
    </div>
  );
}
