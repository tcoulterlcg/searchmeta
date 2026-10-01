import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Used by the mobile app. Authenticated with the user's Supabase access token. */
async function userFrom(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const db = createServiceClient();
  const { data } = await db.auth.getUser(token);
  return data.user ? { db, user: data.user } : null;
}

/** Account details the app needs: the Heritage forwarding address. */
export async function GET(req: NextRequest) {
  const ctx = await userFrom(req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await ctx.db.from("profiles").select("inbound_token").eq("id", ctx.user.id).maybeSingle();
  const base = process.env.INBOUND_EMAIL_ADDRESS;
  const inboundAddress = base && profile?.inbound_token ? base.replace("@", `+${profile.inbound_token}@`) : null;
  return NextResponse.json({ email: ctx.user.email, inboundAddress });
}

/** Permanently deletes the account and everything tied to it (required by the App Store). */
export async function DELETE(req: NextRequest) {
  const ctx = await userFrom(req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { error } = await ctx.db.auth.admin.deleteUser(ctx.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
