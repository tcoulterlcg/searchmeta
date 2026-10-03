"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/owner";
import { BADGES, type Badge } from "@/components/Badges";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Saves (or clears) the profile picture link. Only https image links are accepted. */
export async function saveAvatar(url: string | null): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  let value: string | null = null;
  if (url && url.trim()) {
    try {
      const u = new URL(url.trim());
      if (u.protocol !== "https:") return { ok: false, error: "Use a link that starts with https://" };
      value = u.toString().slice(0, 2000);
    } catch {
      return { ok: false, error: "That doesn't look like a valid link" };
    }
  }

  const { error } = await supabase.from("profiles").update({ avatar_url: value }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Permanently deletes the signed-in account and everything tied to it. */
export async function deleteAccount(): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const db = createServiceClient();
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return { error: error.message };
  if (user.email) await db.from("member_badges").delete().eq("email", user.email.toLowerCase());
  await supabase.auth.signOut();
  redirect("/");
}

/** Owner only: gives a badge to (or takes it from) the member with this sign-in email. */
export async function setBadge(email: string, badge: Badge, on: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isOwner(user.id))) return { ok: false, error: "Not allowed" };

  const address = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return { ok: false, error: "Enter the email they sign in with" };
  if (!BADGES.includes(badge)) return { ok: false, error: "Unknown badge" };

  const table = createServiceClient().from("member_badges");
  const { error } = on
    ? await table.upsert({ email: address, badge }, { onConflict: "email,badge", ignoreDuplicates: true })
    : await table.delete().eq("email", address).eq("badge", badge);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
