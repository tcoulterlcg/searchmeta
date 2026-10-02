import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Matches found in a search's first minutes are things already listed, not news. */
const SETTLE_MS = 20 * 60 * 1000;

/**
 * Called once a morning by pg_cron. For every search set to "Daily feed", sends its owner
 * one push summing up the last day's new matches, instead of one push per match.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createServiceClient();

  const { data, error } = await db
    .from("matches")
    .select("id, user_id, created_at, saved_search:saved_searches!inner(name, created_at, notify, delivery)")
    .is("notified_at", null)
    .gte("created_at", new Date(Date.now() - DAY_MS).toISOString())
    .eq("saved_search.delivery", "feed")
    .eq("saved_search.notify", true)
    .limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = { id: string; user_id: string; created_at: string; saved_search: { name: string; created_at: string } };
  const byUser = new Map<string, { ids: string[]; searches: Map<string, number> }>();
  for (const m of (data ?? []) as unknown as Row[]) {
    if (Date.parse(m.created_at) - Date.parse(m.saved_search.created_at) < SETTLE_MS) continue;
    const u = byUser.get(m.user_id) ?? { ids: [], searches: new Map<string, number>() };
    u.ids.push(m.id);
    u.searches.set(m.saved_search.name, (u.searches.get(m.saved_search.name) ?? 0) + 1);
    byUser.set(m.user_id, u);
  }

  let pushes = 0;
  for (const [userId, u] of byUser) {
    const top = [...u.searches].sort((a, b) => b[1] - a[1]);
    const lines = top.slice(0, 4).map(([name, n]) => `${name}: ${n}`);
    if (top.length > 4) lines.push(`+ ${top.length - 4} more searches`);
    pushes += await sendPushToUser(db, userId, {
      title: `🟢 Your daily feed · ${u.ids.length} new ${u.ids.length === 1 ? "match" : "matches"}`,
      body: lines.join("\n"),
      url: "/alerts",
      tag: "daily-feed",
    });
    for (let i = 0; i < u.ids.length; i += 500) {
      await db.from("matches").update({ notified_at: new Date().toISOString() }).in("id", u.ids.slice(i, i + 500));
    }
  }
  return NextResponse.json({ people: byUser.size, pushes });
}
