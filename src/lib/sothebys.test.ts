import { describe, expect, it } from "vitest";
import { cleanCard, collectLinks } from "./sources/sothebys";

describe("Sotheby's card text", () => {
  it("strips the type label and pulls out the price", () => {
    expect(cleanCard("Type: retail 12/18 Shai Gilgeous-Alexander 25/26 Oklahoma City Thunder Icon Edition Jersey 38,700 USD")).toEqual({
      title: "12/18 Shai Gilgeous-Alexander 25/26 Oklahoma City Thunder Icon Edition Jersey",
      price: 38700,
    });
    expect(cleanCard("Type: retail Pro Football Hall of Fame Archival Print").price).toBeNull();
  });
});

describe("Sotheby's link collector", () => {
  it("finds auctions, buy-now items and lots", () => {
    const html = `
      <a href="/en/buy/auction/2026/winter-sports-classic">Winter Sports Classic</a>
      <a href="https://www.sothebys.com/en/buy/_1218-shai-gilgeous-alexander-2526-oklahoma-city-thunder-8f29?locale=en"><img src="https://brightspotcdn.byic.com/x.jpg">Shai Gilgeous-Alexander 2025-26 Game Worn Jersey</a>
      <a href="/en/buy/auction/2026/winter-sports-classic/wayne-gretzky-rookie-card">Lot 1</a>
      <a href="/en/about">About</a>`;
    expect(collectLinks(html, /^\/en\/buy\/auction\/\d{4}\/[a-z0-9-]+\/?$/).map((l) => l.path)).toEqual([
      "/en/buy/auction/2026/winter-sports-classic",
    ]);
    const buy = collectLinks(html, /^\/en\/buy\/_[a-z0-9-]+\/?$/);
    expect(buy[0].title).toBe("Shai Gilgeous-Alexander 2025-26 Game Worn Jersey");
    expect(buy[0].image).toBe("https://brightspotcdn.byic.com/x.jpg");
    const lots = collectLinks(html, /^\/en\/buy\/auction\/2026\/winter-sports-classic\/[a-z0-9-]+\/?$/);
    expect(lots[0].title).toBe("Wayne Gretzky Rookie Card");
  });
});
