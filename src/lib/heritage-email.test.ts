import { describe, expect, it } from "vitest";
import { findLotUrl, parseHeritageEmail } from "./sources/heritage-email";

const LOT = "https://www.ha.com/itm/hockey-cards/2015-16-upper-deck-the-cup-nikita-kucherov-shield/a/802452-11234.s";

describe("Heritage email parser", () => {
  it("finds a direct lot link with its title and image", () => {
    const html = `<a href="${LOT}"><img src="https://dyn1.heritagestatic.com/x.jpg"></a>
      <a href="${LOT}?ic=wantlist">2015-16 Upper Deck The Cup Nikita Kucherov Shield Patch /25</a>`;
    const out = parseHeritageEmail(html);
    expect(out).toHaveLength(1);
    expect(out[0].external_id).toBe("802452-11234");
    expect(out[0].title).toContain("Kucherov Shield");
    expect(out[0].image_url).toBe("https://dyn1.heritagestatic.com/x.jpg");
    expect(out[0].url).toBe(LOT);
  });

  it("unwraps click-tracking redirects", () => {
    const wrapped = `https://click.email.ha.com/?qs=abc&u=${encodeURIComponent(LOT)}`;
    expect(findLotUrl(wrapped)?.lotId).toBe("802452-11234");
  });

  it("ignores non-lot links and falls back to plain text", () => {
    expect(parseHeritageEmail(`<a href="https://www.ha.com/c/login.zx">Sign in</a>`)).toHaveLength(0);
    expect(parseHeritageEmail("", `New match: ${LOT}`)).toHaveLength(1);
  });
});
