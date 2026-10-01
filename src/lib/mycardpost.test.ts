import { describe, expect, it } from "vitest";
import { parseMarketplacePage } from "./sources/mycardpost";

const html = `
<div class="card">
  <a href="/marketplace/hockey/2015-16-the-cup-nikita-kucherov-shield-25/1247740"><img src="https://cdn.mycardpost.com/img/abc.jpg"></a>
  <a href="/marketplace/hockey/2015-16-the-cup-nikita-kucherov-shield-25/1247740">2015-16 The Cup Nikita Kucherov Shield /25</a>
  <span class="price">$1,250.00</span>
</div>
<div class="card">
  <a href="https://mycardpost.com/index.php/marketplace/baseball/2026-topps-chrome-ohtani-btp-3/1247739">2026 Topps Chrome Ohtani BTP-3</a>
  <span>$45.00</span><span>3 bids</span>
</div>`;

describe("MyCardPost page parser", () => {
  it("reads id, title, price, image and format", () => {
    const out = parseMarketplacePage(html);
    expect(out.map((l) => l.external_id)).toEqual(["1247740", "1247739"]);
    expect(out[0].title).toBe("2015-16 The Cup Nikita Kucherov Shield /25");
    expect(out[0].price).toBe(1250);
    expect(out[0].image_url).toBe("https://cdn.mycardpost.com/img/abc.jpg");
    expect(out[0].buying_formats).toEqual(["buy_it_now"]);
    expect(out[1].buying_formats).toEqual(["auction"]);
    expect(out[1].url).toBe("https://mycardpost.com/marketplace/baseball/2026-topps-chrome-ohtani-btp-3/1247739");
  });
});
