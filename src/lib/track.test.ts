import { describe, expect, it } from "vitest";
import { hasClosed, saleFrom } from "./track";

const HOUR = 60 * 60 * 1000;
const now = Date.parse("2026-10-10T12:00:00Z");
const lot = {
  source: "wheatland",
  external_id: "42",
  title: "1986 Fleer Michael Jordan PSA 8",
  url: "https://example.com/x-LOT42.aspx",
  image_url: null,
  bid: 5200,
  final: null as number | null,
  ends_at: "2026-10-09T03:00:00.000Z",
  last_seen_at: new Date(now - 5 * HOUR).toISOString(),
};

describe("sold prices from watched auctions", () => {
  it("closes a lot once the auction is over and the catalog stopped showing it", () => {
    expect(hasClosed(lot, now)).toBe(true);
  });
  it("keeps a lot that was seen recently, even past its end date (extended bidding)", () => {
    expect(hasClosed({ ...lot, last_seen_at: new Date(now - HOUR).toISOString() }, now)).toBe(false);
  });
  it("keeps a lot whose auction has not ended, even if a read missed it", () => {
    expect(hasClosed({ ...lot, ends_at: "2026-10-20T03:00:00.000Z" }, now)).toBe(false);
  });
  it("closes a lot with no end date only after two days unseen", () => {
    expect(hasClosed({ ends_at: null, last_seen_at: new Date(now - 5 * HOUR).toISOString() }, now)).toBe(false);
    expect(hasClosed({ ends_at: null, last_seen_at: new Date(now - 50 * HOUR).toISOString() }, now)).toBe(true);
  });
  it("saves the last bid as the sale when no final price was seen", () => {
    expect(saleFrom(lot, lot.last_seen_at)).toMatchObject({ source: "wheatland", external_id: "42", price: 5200, sale_type: "auction", sold_at: lot.ends_at });
  });
  it("prefers the final price the catalog shows", () => {
    expect(saleFrom({ ...lot, final: 6240 }, "2026-10-09T05:00:00.000Z")?.price).toBe(6240);
  });
  it("dates the sale to when it was seen if the end date is unknown", () => {
    expect(saleFrom({ ...lot, ends_at: null, final: 6240 }, "2026-10-09T05:00:00.000Z")?.sold_at).toBe("2026-10-09T05:00:00.000Z");
  });
  it("saves nothing for a lot that never got a bid", () => {
    expect(saleFrom({ ...lot, bid: null }, lot.last_seen_at)).toBeNull();
  });
});
