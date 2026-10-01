import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { CRAWLABLE, runSource } from "@/lib/crawl";
import type { SourceId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Called on a schedule (Supabase pg_cron) for each source. Protected by CRON_SECRET. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ source: string }> }) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { source } = await params;
  if (!CRAWLABLE.includes(source as SourceId)) {
    return NextResponse.json({ error: `unknown source: ${source}` }, { status: 404 });
  }

  const debug = req.nextUrl.searchParams.get("debug") === "1";
  const result = await runSource(createServiceClient(), source as SourceId, { debug });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
