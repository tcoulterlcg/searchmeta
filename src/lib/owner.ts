import { createServiceClient } from "./supabase/server";

/** Site owners are listed in the `owners` table, which only the service role can read. */
export async function isOwner(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data } = await createServiceClient().from("owners").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}
