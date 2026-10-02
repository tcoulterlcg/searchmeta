import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/owner";
import { exportFile } from "@/lib/export";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Flat-file backups for the signed-in owner. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isOwner(user?.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return exportFile((await params).file, req);
}
