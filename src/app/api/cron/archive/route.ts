import { NextResponse, type NextRequest } from "next/server";
import { archiveEnabled, countSales, getJob, saveSales, setJob } from "@/lib/archive";
import { goldinBackfillStep, newGoldinBackfill, type GoldinBackfillState } from "@/lib/sources/goldin";
import { createServiceClient } from "@/lib/supabase/server";
import type { SaleInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/** Copies sales saved in Supabase before the archive moved to Turso (runs once). */
async function copyFromSupabase() {
  if (await getJob("supabase-copy")) return 0;
  const db = createServiceClient();
  let copied = 0;
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from("sales")
      .select("source, external_id, title, url, image_url, price, sale_type, sold_at")
      .range(from, from + 999);
    if (!data?.length) break;
    copied += await saveSales(data as SaleInput[]);
    if (data.length < 1000) break;
  }
  await setJob("supabase-copy", { done: true, copied });
  return copied;
}

/** Called every minute by pg_cron. Keeps the full Goldin sold archive in Turso. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!archiveEnabled()) return NextResponse.json({ ok: false, error: "Turso not configured" });

  const deadline = Date.now() + 45_000;
  try {
    const copied = await copyFromSupabase();

    let state = await getJob<GoldinBackfillState>("goldin-sold");
    if (!state || (state.finishedAt && Date.now() - Date.parse(state.finishedAt) > REFRESH_AFTER_MS)) {
      state = newGoldinBackfill();
    }
    if (!state.finishedAt) {
      try {
        state = await goldinBackfillStep(state, saveSales, deadline);
      } finally {
        await setJob("goldin-sold", state); // keep progress even if a page fails
      }
    }

    return NextResponse.json({
      ok: true,
      copied,
      goldin: { pages: state.pages, saved: state.saved, bandsLeft: state.queue.length, finishedAt: state.finishedAt },
      totals: req.nextUrl.searchParams.get("counts") === "1" ? await countSales() : undefined,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
