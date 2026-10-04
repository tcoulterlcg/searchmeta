import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { alertPayload } from "@/lib/ingest";
import { sendPushToUser } from "@/lib/push";
import type { Listing } from "@/lib/types";

/** Sends a test alert built from your most recent real match, in exactly the format live alerts use. */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: match } = await supabase
    .from("matches")
    .select("listing:listings!inner(*), saved_search:saved_searches(name)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ listing: Listing; saved_search: { name: string } | null }>();

  const payload = match
    ? { ...alertPayload(match.listing, match.saved_search?.name ?? "Your search"), tag: `test-${Date.now()}` }
    : {
        title: "🟢 GrailFindr · Test alert",
        body: "This is what a match will look like.\nSave a search to see a real one.",
        url: "/alerts",
      };

  const sent = await sendPushToUser(createServiceClient(), user.id, payload);
  return NextResponse.json({ ok: true, sent });
}
