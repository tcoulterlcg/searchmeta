import type { SupabaseClient } from "@supabase/supabase-js";
import { archiveEnabled, saveSales } from "./archive";
import { RESULTS_HOUSES, type CatalogLot, type House } from "./sources/houses";
import type { SaleInput } from "./types";

/**
 * Sold prices from the auctions we watch.
 *
 * Every time an auction house's catalog is read, the latest bid on each lot is kept in
 * `tracked_lots`. Once an auction is over and a lot has left the catalog, the last bid we
 * saw is saved to the sold archive as its sale price, and the lot is dropped from the table.
 * Lots that never got a bid are dropped without a sale.
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
  ends_at: string | null;
  last_seen_at: string;
}

export const tracksSales = (h: House) => !RESULTS_HOUSES.some((r) => r.id === h.id);

/** The sale to record for a lot that has closed, or null if it never got a bid. */
export function saleFrom(lot: TrackedLot): SaleInput | null {
  if (!lot.bid || lot.bid <= 0) return null;
  const day = (lot.ends_at ?? lot.last_seen_at).slice(0, 10).replace(/-/g, "");
  return {
    source: lot.source as SaleInput["source"],
    // Lot numbers repeat from one auction to the next, so the auction's date is part of the id.
    external_id: `${lot.external_id}-${day}`,
    title: lot.title,
    url: lot.url,
    image_url: lot.image_url,
    price: lot.bid,
    sale_type: "auction",
    sold_at: lot.ends_at ?? lot.last_seen_at,
  };
}

/** True once a lot's auction is over and the catalog has stopped showing it. */
export function hasClosed(lot: Pick<TrackedLot, "ends_at" | "last_seen_at">, now: number): boolean {
  const unseen = now - Date.parse(lot.last_seen_at);
  if (unseen < GONE_AFTER_MS) return false;
  return lot.ends_at ? Date.parse(lot.ends_at) < now : unseen > NO_DATE_GONE_AFTER_MS;
}

/**
 * Records the bids just read, and when `passComplete` (the whole catalog has been read)
 * saves the sale price of lots that have closed.
 */
export async function trackLots(db: SupabaseClient, h: House, lots: CatalogLot[], passComplete: boolean) {
  if (!tracksSales(h) || !archiveEnabled()) return { tracked: 0, sold: 0 };
  const now = new Date();
  const rows: TrackedLot[] = lots.map(({ listing, bid }) => ({
    source: h.id,
    external_id: listing.external_id,
    title: listing.title,
    url: listing.url,
    image_url: listing.image_url ?? null,
    bid,
    ends_at: listing.ends_at ?? null,
    last_seen_at: now.toISOString(),
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("tracked_lots").upsert(rows.slice(i, i + 500), { onConflict: "source,external_id" });
    if (error) throw error;
  }
  if (!passComplete) return { tracked: rows.length, sold: 0 };

  const { data, error } = await db
    .from("tracked_lots")
    .select("*")
    .eq("source", h.id)
    .lt("last_seen_at", new Date(now.getTime() - GONE_AFTER_MS).toISOString())
    .limit(5000);
  if (error) throw error;
  const closed = ((data ?? []) as TrackedLot[]).filter((l) => hasClosed(l, now.getTime()));
  if (!closed.length) return { tracked: rows.length, sold: 0 };

  const sales = closed.map(saleFrom).filter((s): s is SaleInput => s !== null);
  await saveSales(sales);
  // Only forget a lot after its sale is safely saved.
  for (let i = 0; i < closed.length; i += 200) {
    const { error: delError } = await db
      .from("tracked_lots")
      .delete()
      .eq("source", h.id)
      .in("external_id", closed.slice(i, i + 200).map((l) => l.external_id));
    if (delError) throw delError;
  }
  return { tracked: rows.length, sold: sales.length };
}
