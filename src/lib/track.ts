import type { SupabaseClient } from "@supabase/supabase-js";
import { archiveEnabled, saveSales } from "./archive";
import { RESULTS_HOUSES, type CatalogLot, type House } from "./sources/houses";
import type { SaleInput } from "./types";

/**
 * Sold prices from the auctions we watch.
 *
 * Every time an auction house's catalog is read, each lot is kept in `tracked_lots` with
 * its latest bid. A lot's sale is saved to the sold archive in one of two ways:
 *  - the catalog shows a "Final Price" once the auction closes (the normal case), or
 *  - the auction is over and the lot left the catalog before we saw a final price, in
 *    which case the last bid we saw is used.
 * Lots that never got a bid are not saved.
 *
 * Houses whose published results we already copy are skipped, so nothing is saved twice.
 */

/** A lot counts as gone once a full read of the catalog has not shown it for this long. */
const GONE_AFTER_MS = 2 * 60 * 60 * 1000;
/** Lots with no end date are closed out after going unseen this long. */
const NO_DATE_GONE_AFTER_MS = 48 * 60 * 60 * 1000;

interface TrackedLot {
  source: string;
  external_id: string;
  title: string;
  url: string;
  image_url: string | null;
  bid: number | null;
  final: number | null;
  ends_at: string | null;
  last_seen_at: string;
  saved_at?: string | null;
}

export const tracksSales = (h: House) => !RESULTS_HOUSES.some((r) => r.id === h.id);

/** The sale to record for a lot, or null if it has no price to record. `soldAt` is used when the end date is unknown. */
export function saleFrom(lot: TrackedLot, soldAt: string): SaleInput | null {
  const price = lot.final ?? lot.bid;
  if (!price || price <= 0) return null;
  return {
    source: lot.source as SaleInput["source"],
    external_id: lot.external_id,
    title: lot.title,
    url: lot.url,
    image_url: lot.image_url,
    price,
    sale_type: "auction",
    sold_at: lot.ends_at && Date.parse(lot.ends_at) < Date.parse(soldAt) ? lot.ends_at : soldAt,
  };
}

/** True once a lot's auction is over and the catalog has stopped showing it. */
export function hasClosed(lot: Pick<TrackedLot, "ends_at" | "last_seen_at">, now: number): boolean {
  const unseen = now - Date.parse(lot.last_seen_at);
  if (unseen < GONE_AFTER_MS) return false;
  return lot.ends_at ? Date.parse(lot.ends_at) < now : unseen > NO_DATE_GONE_AFTER_MS;
}

async function markSaved(db: SupabaseClient, source: string, ids: string[], at: string) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db.from("tracked_lots").update({ saved_at: at }).eq("source", source).in("external_id", ids.slice(i, i + 200));
    if (error) throw error;
  }
}

/**
 * Records the lots just read and saves any sales they reveal. When `passComplete`
 * (the whole catalog has been read) it also closes out lots that have left the catalog.
 */
export async function trackLots(db: SupabaseClient, h: House, lots: CatalogLot[], passComplete: boolean) {
  // Every house's lots are kept (the Search tab reads them); sales are only saved for
  // houses whose published results we do not already copy.
  const saves = tracksSales(h) && archiveEnabled();
  const now = new Date();
  const nowIso = now.toISOString();
  const rows: TrackedLot[] = lots.map(({ listing, bid, final }) => ({
    source: h.id,
    external_id: listing.external_id,
    title: listing.title,
    url: listing.url,
    image_url: listing.image_url ?? null,
    bid,
    final,
    ends_at: listing.ends_at ?? null,
    last_seen_at: nowIso,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("tracked_lots").upsert(rows.slice(i, i + 500), { onConflict: "source,external_id" });
    if (error) throw error;
  }

  // Lots showing a final price that we have not saved yet.
  let sold = 0;
  const { data: unsaved, error: unsavedError } = await db
    .from("tracked_lots")
    .select("*")
    .eq("source", h.id)
    .is("saved_at", null)
    .not("final", "is", null)
    .limit(5000);
  if (unsavedError) throw unsavedError;
  const finals = saves ? ((unsaved ?? []) as TrackedLot[]) : [];
  if (finals.length) {
    const sales = finals.map((l) => saleFrom(l, nowIso)).filter((s): s is SaleInput => s !== null);
    await saveSales(sales);
    await markSaved(db, h.id, finals.map((l) => l.external_id), nowIso);
    sold += sales.length;
  }
  if (!passComplete) return { tracked: rows.length, sold };

  // Lots that left the catalog after their auction ended.
  const { data: gone, error: goneError } = await db
    .from("tracked_lots")
    .select("*")
    .eq("source", h.id)
    .lt("last_seen_at", new Date(now.getTime() - GONE_AFTER_MS).toISOString())
    .limit(5000);
  if (goneError) throw goneError;
  const closed = ((gone ?? []) as TrackedLot[]).filter((l) => hasClosed(l, now.getTime()));
  if (closed.length) {
    if (saves) {
      const sales = closed.filter((l) => !l.saved_at).map((l) => saleFrom(l, l.last_seen_at)).filter((s): s is SaleInput => s !== null);
      await saveSales(sales);
      sold += sales.length;
    }
    // Only forget a lot after its sale is safely saved.
    for (let i = 0; i < closed.length; i += 200) {
      const { error } = await db.from("tracked_lots").delete().eq("source", h.id).in("external_id", closed.slice(i, i + 200).map((l) => l.external_id));
      if (error) throw error;
    }
  }
  return { tracked: rows.length, sold };
}
