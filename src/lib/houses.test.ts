import { describe, expect, it } from "vitest";
import { formFields, HOUSES, lotsPerPageControl, parseCatalog, parseGallery } from "./sources/houses";
import { parseMySlabs } from "./sources/myslabs";
import { toCollectorCryptListing } from "./sources/collectorcrypt";

const lelands = HOUSES.find((h) => h.id === "lelands")!;
const sirius = HOUSES.find((h) => h.id === "sirius")!;

const galleryItem = (id: number, title: string, status: string, price: string) => `
  <div class="col-lg-3 col-md-4 col-sm-6">
    <div class="item">
      <h5 class="boxed">2</h5>
      <div class="item-details clearfix">
        <p class="description">
          <a href="https://auction.lelands.com/bids/bidplace.aspx?itemid=${id}">${title}</a>
        </p>
        <div class="item-image">
          <a href="https://auction.lelands.com/bids/bidplace.aspx?itemid=${id}">
            <img src="https://auction.lelands.com/images_items/thumbs/thumb_item_${id}_1.jpg" alt="" class="img-responsive" />
          </a>
        </div>
        <p>Bids: <strong>42</strong><br>Opening Bid: <strong>$10,000</strong><br>Status: <strong>${status}</strong></p>
      </div>
      <div class="item-price">
        <a href="https://auction.lelands.com//bids/bidplace.aspx?itemid=${id}">${price}</a>
      </div>
    </div>
  </div>`;

describe("gallery auction software (Lelands and others)", () => {
  it("reads lots and tells open lots from closed ones", () => {
    const html =
      galleryItem(137205, "1933 Lou Gehrig New York Yankees Player Contract (PSA)", "Sold", "SOLD FOR $90,190") +
      galleryItem(136964, "1996 Flair Showcase Michael Jordan #24/150 PSA 8.5", "Open", "CURRENT BID $12,500");
    const lots = parseGallery(lelands, html);
    expect(lots.map((l) => l.open)).toEqual([false, true]);
    expect(lots[1].lot).toMatchObject({
      source: "lelands",
      external_id: "136964",
      title: "1996 Flair Showcase Michael Jordan #24/150 PSA 8.5",
      url: "https://auction.lelands.com/bids/bidplace.aspx?itemid=136964",
      image_url: "https://auction.lelands.com/images_items/thumbs/thumb_item_136964_1.jpg",
      price: 12500,
      buying_formats: ["auction"],
    });
  });
});

const catalogPage = `<html><head><title>
	Catalog - Sirius Sports Cards Auction # 425 - Ends 10/8/26
</title></head><body><form>
<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="abc+/=" />
<input type="hidden" name="__EVENTVALIDATION" value="xyz" />
<input type="submit" name="ctl00$go" value="Go" />
<select name="ctl00$ContentPlaceHolder$perPage" onchange="javascript:setTimeout('__doPostBack(\\'ctl00$ContentPlaceHolder$perPage\\',\\'\\')', 0)">
  <option selected="selected" value="25">25</option><option value="50">50</option><option value="100000">All</option>
</select>
<select name="ctl00$ContentPlaceHolder$sort"><option value="lot">Lot Number</option><option value="all">All</option></select>
<div id="galleryList"><ul><li>
<div class="lot ">
  <div class="lotInner"><h5><span id='LotLabel'>Lot </span><span class='LotNumberSign'>#</span><span id='LotNumber'>1</span><span id="LotName">
   <a href='http://siriussportsauctions.com/1950_BOWMAN_113_GENE_HERMANSKI_PSA_EX_MT_6-LOT1748829.aspx'>1950 BOWMAN 113 GENE HERMANSKI PSA EX-MT 6</a></span></h5>
  <div class="imageDiv"><a href='http://siriussportsauctions.com/1950_BOWMAN_113_GENE_HERMANSKI_PSA_EX_MT_6-LOT1748829.aspx'><center><img class='lotImage' src='/ItemImages/001748/4250001_sm.jpeg' align='middle' alt='x'></center></a></div>
  <div class="lotData"><h6><span># Bids: 3</span></h6><h6><span>Min Bid: $1.00</span></h6><h6><span>Current Bid: $22.00</span></h6></div>
</div></li></ul></div></form></body></html>`;

describe("catalog auction software (Sirius and others)", () => {
  it("reads lots with price, image and end date", () => {
    const lots = parseCatalog(sirius, catalogPage);
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({
      source: "sirius",
      external_id: "1748829",
      title: "1950 BOWMAN 113 GENE HERMANSKI PSA EX-MT 6",
      url: "https://www.siriussportsauctions.com/1950_BOWMAN_113_GENE_HERMANSKI_PSA_EX_MT_6-LOT1748829.aspx",
      image_url: "https://www.siriussportsauctions.com/ItemImages/001748/4250001_sm.jpeg",
      price: 22,
    });
    expect(lots[0].ends_at?.slice(0, 10)).toBe("2026-10-09");
  });
  it("finds the lots-per-page dropdown and the form fields to send back", () => {
    expect(lotsPerPageControl(catalogPage)).toEqual({ name: "ctl00$ContentPlaceHolder$perPage", all: "100000" });
    const form = formFields(catalogPage);
    expect(form.get("__VIEWSTATE")).toBe("abc+/=");
    expect(form.get("ctl00$ContentPlaceHolder$perPage")).toBe("25");
    expect(form.has("ctl00$go")).toBe(false);
  });
});

describe("MySlabs", () => {
  it("reads slabs from the listing grid", () => {
    const html = `<div
  class="slab_item
  ">
  <div class="slab_item_img"><a href="/slab/view/1857684/">
    <img loading="lazy" class="lazy" data-src="https://cdn.myslabs.com/media/a.png?width=360&amp;height=610" alt="1986 fleer World B Free CGC 7.5" /></a></div>
  <a href="/slab/view/1857684/" class="text-decoration-none"><div class="slab-title">
     1986 fleer World B Free CGC 7.5
  </div></a>
  <div class="d-flex flex-column w-100 slab-details"><div class="item-price">
     $1,039
  </div></div>
  <img src="https://cdn.myslabs.com/static/img/buy-offer.png" /></div>`;
    expect(parseMySlabs(html)).toEqual([
      expect.objectContaining({
        source: "myslabs",
        external_id: "1857684",
        title: "1986 fleer World B Free CGC 7.5",
        url: "https://myslabs.com/slab/view/1857684/",
        image_url: "https://cdn.myslabs.com/media/a.png?width=360&height=610",
        price: 1039,
        buying_formats: ["buy_it_now", "best_offer"],
        graded: true,
      }),
    ]);
  });
});

describe("Collector Crypt", () => {
  it("maps a marketplace card and skips ones without a name", () => {
    expect(
      toCollectorCryptListing({ nftAddress: "Mint111", itemName: "2020 Prizm Justin Herbert PSA 10", listing: { price: "450", currency: "USDC" }, images: { front: "https://img/f.jpg" }, gradingCompany: "PSA" }),
    ).toMatchObject({ external_id: "Mint111", price: 450, image_url: "https://img/f.jpg", graded: true, url: "https://collectorcrypt.com/assets/solana/Mint111" });
    expect(toCollectorCryptListing({ nftAddress: "Mint222" })).toBeNull();
  });
});
