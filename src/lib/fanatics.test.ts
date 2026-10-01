import { describe, expect, it } from "vitest";
import { nextWindow, toFanaticsSale, toSearchText } from "./sources/fanatics";

describe("Fanatics search text", () => {
  it("keeps required words and phrases, drops exclusions and wildcards", () => {
    expect(toSearchText('kucherov shield -reprint "logo patch" kuch*')).toBe("kucherov shield logo patch");
  });
  it("returns null when nothing is required", () => {
    expect(toSearchText("-reprint")).toBeNull();
  });
});

describe("Fanatics sold archive", () => {
  it("shrinks a slice that holds too many sales and grows a quiet one, 4x at most", () => {
    expect(nextWindow(600, 6000)).toBe(150);
    expect(nextWindow(600, 0)).toBe(2400);
    expect(nextWindow(1, 5000)).toBe(1);
    expect(nextWindow(20 * 86_400, 10)).toBe(30 * 86_400);
  });
  it("records what the buyer paid and a link that needs no title", () => {
    const sale = toFanaticsSale({
      listingUuid: "abc", title: "2019 Kobe", subtitle: "PSA 10", marketplace: "WEEKLY",
      currentPrice: 925, purchasePrice: 1110, soldDate: 1790565552,
      images: { primary: { small: "https://img/s.jpg" } },
    });
    expect(sale).toMatchObject({
      external_id: "abc", title: "2019 Kobe PSA 10", price: 1110, sale_type: "auction",
      url: "https://www.fanaticscollect.com/weekly/abc", image_url: "https://img/s.jpg",
      sold_at: "2026-09-28T03:19:12.000Z",
    });
    expect(toFanaticsSale({ listingUuid: "x", title: "t", marketplace: "FIXED", currentPrice: 199 })).toMatchObject({
      price: 199, sale_type: "buy_it_now", url: "https://www.fanaticscollect.com/buy-now/x",
    });
  });
});
