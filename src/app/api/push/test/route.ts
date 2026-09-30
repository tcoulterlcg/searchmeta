import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sent = await sendPushToUser(createServiceClient(), user.id, {
    title: "SearchMeta is watching",
    body: "Test alert: this is what a match will look like.",
    url: "/alerts",
  });
  return NextResponse.json({ ok: true, sent });
}
