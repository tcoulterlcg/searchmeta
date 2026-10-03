import { BADGES, type Badge } from "@/components/Badges";
import { createServiceClient } from "./supabase/server";

/**
 * Badges live in `member_badges`, keyed by sign-in email, so one can be given before the
 * person signs up. Only the service role can read or write the table.
 */
export async function getBadges(email: string | null | undefined): Promise<Badge[]> {
  if (!email) return [];
  const { data } = await createServiceClient().from("member_badges").select("badge").eq("email", email.toLowerCase());
  const have = new Set((data ?? []).map((r) => r.badge as string));
  return BADGES.filter((b) => have.has(b));
}

/** Every badge on file, for the owner's list in Settings. */
export async function listBadges(): Promise<{ email: string; badge: Badge }[]> {
  const { data } = await createServiceClient().from("member_badges").select("email, badge").order("email");
  return (data ?? []).filter((r) => (BADGES as readonly string[]).includes(r.badge)) as { email: string; badge: Badge }[];
}
