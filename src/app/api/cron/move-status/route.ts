import { NextResponse } from "next/server";
import { newArchiveConfigured, oldArchiveConfigured } from "@/lib/archive";
import { readMoveState } from "@/lib/archive-move";

export const dynamic = "force-dynamic";

/**
 * Progress of the one-time archive move to the new Turso database (counts only, no data).
 * Temporary: remove once the move is done.
 */
export async function GET() {
  try {
    const st = await readMoveState();
    return NextResponse.json({
      oldConfigured: oldArchiveConfigured(),
      newConfigured: newArchiveConfigured(),
      started: Boolean(st),
      done: st?.done ?? false,
      doneAt: st?.doneAt ?? null,
      copiedTo: st?.copiedTo ?? 0,
      oldMax: st?.oldMax ?? 0,
      percent: st?.oldMax ? Math.round((1000 * st.copiedTo) / st.oldMax) / 10 : 0,
      monthCopied: st?.monthCopied ?? 0,
      pausedForMonth: st?.pausedForMonth ?? false,
      lastError: st?.lastError ?? null,
      updatedAt: st?.updatedAt ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
