import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runHealthCheck } from "@/lib/health";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called every 15 minutes by pg_cron. Alerts the owners by phone and email when a site
 * stops being checked. `?test=1` sends a test alarm straight away.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const test = req.nextUrl.searchParams.get("test") === "1";
  return NextResponse.json(await runHealthCheck(createServiceClient(), { test }));
}
