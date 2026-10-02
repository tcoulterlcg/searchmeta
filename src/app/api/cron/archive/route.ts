import { NextResponse, type NextRequest } from "next/server";
import { archiveEnabled, countSales, getJob, saveSales, setJob } from "@/lib/archive";
import { goldinBackfillStep, newGoldinBackfill, type GoldinBackfillState } from "@/lib/sources/goldin";
import {
  fanaticsBackfillStep,
  newFanaticsBackfill,
  type FanaticsBackfillState,
} from "@/lib/sources/fanatics";
import { fetchMySlabsSoldPage, mySlabsSoldStep, newMySlabsSold, type MySlabsSoldState } from "@/lib/sources/myslabs";
import {
  HOUSES,
  newResultsState,
  parseCatalog,
  probeResults,
  RESULTS_HOUSES,
  resultsStep,
  type ResultsState,
} from "@/lib/sources/houses";
import { getHtml, text } from "@/lib/sources/html";
import { createServiceClient } from "@/lib/supabase/server";
import type { SaleInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Turso's free plan allows 10M row writes a month and each sale costs a few.
 * This caps how many Fanatics sales are copied per month so the allowance
 * isn't used up. Set FANATICS_MONTHLY_CAP=0 to remove the cap on a paid plan.
 */
const FANATICS_MONTHLY_CAP = Number(process.env.FANATICS_MONTHLY_CAP ?? 1_500_000);

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

/** Called every minute by pg_cron. Keeps the full Goldin and Fanatics sold archives in Turso. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!archiveEnabled()) return NextResponse.json({ ok: false, error: "Turso not configured" });

  // Test read of a sold-archive page, without saving anything: ?probe=myslabs&page=1
  if (req.nextUrl.searchParams.get("probe") === "myslabs") {
    const r = await fetchMySlabsSoldPage(Number(req.nextUrl.searchParams.get("page") ?? 1));
    return NextResponse.json({
      found: r.sales.length,
      dated: r.sales.filter((s) => s.sold_at).length,
      priced: r.sales.filter((s) => s.price != null).length,
      sample: r.sales.slice(0, 2),
      firstText: r.firstText,
    });
  }

  // Test read of an auction house's past results, choosing one auction: ?probe=results&id=sirius
  if (req.nextUrl.searchParams.get("probe") === "results") {
    const house = HOUSES.find((h) => h.id === req.nextUrl.searchParams.get("id"));
    if (!house) return NextResponse.json({ error: "unknown house" }, { status: 400 });
    return NextResponse.json(await probeResults(house));
  }

  // Test read of an auction house's past-results page: ?probe=house&id=sirius&path=auctionresults.aspx
  if (req.nextUrl.searchParams.get("probe") === "house") {
    const house = HOUSES.find((h) => h.id === req.nextUrl.searchParams.get("id"));
    const path = req.nextUrl.searchParams.get("path") ?? "auctionresults.aspx";
    if (!house || !/^[\w.\-?=&/]+$/.test(path)) return NextResponse.json({ error: "unknown house or path" }, { status: 400 });
    const html = await (await getHtml(`${house.base}/${path}`)).text();
    const links = [...new Set([...html.matchAll(/href=['"]([^'"#]+)['"]/g)].map((m) => m[1].replace(/\d+/g, "N")))];
    const body = text(html.split(/<body[^>]*>/i)[1] ?? html);
    const at = Math.max(0, body.search(/prices? realized|results|final/i));
    return NextResponse.json({
      lots: parseCatalog(house, html).length,
      sample: parseCatalog(house, html).slice(0, 2),
      links: links.filter((l) => /result|auction|archive|price/i.test(l)).slice(0, 25),
      text: body.slice(at, at + 900),
      lotText: text(html.split(/<div class="lot\s*">/)[1] ?? "").slice(0, 300),
      // What follows the search form: the results themselves.
      afterForm: html.slice(html.lastIndexOf("GoBtn")).replace(/\s+/g, " ").slice(0, 3200),
      size: html.length,
    });
  }

  const start = Date.now();
  const deadline = start + 45_000;
  const errors: Record<string, string> = {};
  const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
  try {
    const copied = await copyFromSupabase();

    let goldin = await getJob<GoldinBackfillState>("goldin-sold");
    const restart = req.nextUrl.searchParams.get("restart") === "goldin";
    if (!goldin || restart || (goldin.finishedAt && Date.now() - Date.parse(goldin.finishedAt) > REFRESH_AFTER_MS)) {
      goldin = newGoldinBackfill();
    }
    let fanatics = (await getJob<FanaticsBackfillState>("fanatics-sold")) ?? newFanaticsBackfill();

    if (!goldin.finishedAt) {
      try {
        // While both copies are running they share the minute.
        goldin = await goldinBackfillStep(goldin, saveSales, start + 22_000);
      } catch (e) {
        errors.goldin = message(e);
      } finally {
        await setJob("goldin-sold", goldin); // keep progress even if a page fails
      }
    }

    try {
      fanatics = await fanaticsBackfillStep(fanatics, saveSales, deadline, FANATICS_MONTHLY_CAP);
    } catch (e) {
      errors.fanatics = message(e);
    } finally {
      await setJob("fanatics-sold", fanatics);
    }

    // MySlabs sold archive: a few pages a minute so the one-time copy stays gentle on their site.
    let myslabs = (await getJob<MySlabsSoldState>("myslabs-sold")) ?? newMySlabsSold();
    try {
      myslabs = await mySlabsSoldStep(myslabs, saveSales);
    } catch (e) {
      errors.myslabs = message(e);
    } finally {
      await setJob("myslabs-sold", myslabs);
    }

    // Auction-house past results: one request a minute per house.
    const houses: Record<string, unknown> = {};
    for (const h of RESULTS_HOUSES) {
      let st = (await getJob<ResultsState>(`${h.id}-results`)) ?? newResultsState();
      try {
        st = await resultsStep(h, st, saveSales);
      } catch (e) {
        errors[h.id] = message(e);
      } finally {
        await setJob(`${h.id}-results`, st);
      }
      houses[h.id] = { saved: st.saved, auctionsCopied: st.auctions, auctionsLeft: st.queue.length };
    }

    const failed = Object.keys(errors).length > 0;
    return NextResponse.json(
      {
        ok: !failed,
        copied,
        errors: failed ? errors : undefined,
        goldin: { pages: goldin.pages, saved: goldin.saved, bandsLeft: goldin.queue.length, finishedAt: goldin.finishedAt },
        fanatics: {
          saved: fanatics.saved,
          savedThisMonth: fanatics.monthSaved,
          monthlyCap: FANATICS_MONTHLY_CAP,
          copiedBackTo: new Date(fanatics.tail * 1000).toISOString(),
          newSalesCheckedAt: fanatics.headCheckedAt,
          calls: fanatics.calls,
          finishedAt: fanatics.finishedAt,
        },
        myslabs: { saved: myslabs.saved, nextPage: myslabs.page, pausedUntil: myslabs.pausedUntil ?? null, refusals: myslabs.refusals ?? 0, finishedAt: myslabs.finishedAt },
        houses,
        totals: req.nextUrl.searchParams.get("counts") === "1" ? await countSales() : undefined,
      },
      { status: failed ? 500 : 200 },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: message(e) }, { status: 500 });
  }
}
