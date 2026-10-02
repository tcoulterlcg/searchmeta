import { NextResponse, type NextRequest } from "next/server";
import { exportFile } from "@/lib/export";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Flat-file backups for scheduled jobs, protected by the cron secret. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return exportFile((await params).file, req);
}
