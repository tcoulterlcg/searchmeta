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
  it("saves the last bid as the sale, dated to the auction", () => {
    expect(saleFrom(lot)).toMatchObject({ source: "wheatland", external_id: "42-20261009", price: 5200, sale_type: "auction", sold_at: lot.ends_at });
  });
  it("saves nothing for a lot that never got a bid", () => {
    expect(saleFrom({ ...lot, bid: null })).toBeNull();
  });
});
