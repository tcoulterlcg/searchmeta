"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
