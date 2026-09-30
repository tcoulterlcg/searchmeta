import { describe, expect, it } from "vitest";
import { matchesQuery, parseQuery, prepareText } from "./query";
import { SearchIndex } from "./matcher";
import type { ListingInput, SavedSearch } from "./types";

const m = (q: string, title: string) => matchesQuery(parseQuery(q), prepareText(title));

describe("eBay keyword syntax", () => {
  it("requires all words, any order", () => {
    expect(m("kucherov shield", "2015-16 UD The Cup Nikita Kucherov Shield Patch /25")).toBe(true);
    expect(m("kucherov shield", "Nikita Kucherov Rookie Card")).toBe(false);
  });
  it("is case and punctuation insensitive", () => {
    expect(m("KUCHEROV", "kucherov, nikita!")).toBe(true);
  });
  it("supports exact phrases", () => {
    expect(m('"logo patch"', "Crosby Logo Patch Auto")).toBe(true);
    expect(m('"logo patch"', "Crosby Patch Logo")).toBe(false);
  });
  it("supports exclusions", () => {
    expect(m("kucherov -reprint", "Kucherov RP reprint")).toBe(false);
    expect(m('kucherov -"lot of"', "Lot of 10 Kucherov")).toBe(false);
    expect(m('kucherov -"lot of"', "Kucherov Lot 10")).toBe(true);
  });
  it("supports OR groups", () => {
    expect(m("kucherov (psa,bgs)", "Kucherov BGS 9.5")).toBe(true);
    expect(m("kucherov (psa,bgs)", "Kucherov SGC 10")).toBe(false);
    expect(m("kucherov -(psa,bgs)", "Kucherov SGC 10")).toBe(true);
  });
  it("supports wildcards", () => {
    expect(m("kuch* shield", "Kucherov Shield")).toBe(true);
  });
  it("handles serial numbers", () => {
    expect(m("kucherov 1/1", "Kucherov Shield 1/1")).toBe(true);
    expect(m("kucherov 1/1", "Kucherov Shield /25")).toBe(false);
  });
  it("rejects exclusion-only queries", () => {
    expect(m("-reprint", "Anything")).toBe(false);
  });
});

const base: SavedSearch = {
  id: "s1", user_id: "u1", name: "t", keywords: "kucherov shield", search_description: false,
  sources: [], min_price: null, max_price: null, buying_formats: [], condition: "any",
  free_shipping: false, located_in: null, notify: true, created_at: "", updated_at: "",
};
const listing: ListingInput = {
  source: "ebay", external_id: "1", title: "Nikita Kucherov Shield PSA 9", url: "x",
  price: 500, buying_formats: ["auction"],
};

describe("SearchIndex filters", () => {
  it("matches with filters", () => {
    const idx = new SearchIndex([
      base,
      { ...base, id: "s2", max_price: 100 },
      { ...base, id: "s3", condition: "ungraded" },
      { ...base, id: "s4", buying_formats: ["buy_it_now"] },
      { ...base, id: "s5", sources: ["goldin"] },
      { ...base, id: "s6", keywords: "crosby" },
    ]);
    expect(idx.match(listing).map((s) => s.id)).toEqual(["s1"]);
  });
  it("searches descriptions only when enabled", () => {
    const l = { ...listing, title: "Kucherov card", description: "rare shield" };
    const idx = new SearchIndex([base, { ...base, id: "s2", search_description: true }]);
    expect(idx.match(l).map((s) => s.id)).toEqual(["s2"]);
  });
});
