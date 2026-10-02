"use server";

import { createClient } from "@/lib/supabase/server";

/** Stars or un-stars one of the signed-in person's alerts. */
export async function setStarred(id: string, starred: boolean) {
  const supabase = await createClient();
  await supabase.from("matches").update({ starred }).eq("id", id);
}
