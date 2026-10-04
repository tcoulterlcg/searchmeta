import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Logo";

export const metadata: Metadata = {
  title: "About",
  description: "Every marketplace and auction house GrailFindr searches for you.",
};

type Status = "live" | "setup";

interface Site {
  name: string;
  url: string;
  what: string;
  checked: string;
  status: Status;
}

const MARKETPLACES: Site[] = [
  { name: "eBay", url: "https://www.ebay.com", what: "Sports trading cards, auctions and Buy It Now", checked: "Every minute", status: "setup" },
  { name: "Fanatics Collect", url: "https://www.fanaticscollect.com", what: "Weekly and Premier auctions, plus Buy Now", checked: "Every 2 minutes", status: "live" },
  { name: "Goldin", url: "https://goldin.co", what: "Weekly, Elite and themed auctions, plus Buy Now", checked: "Buy Now every 2 minutes, auctions every 15", status: "live" },
  { name: "MyCardPost", url: "https://mycardpost.com", what: "Collector-to-collector sports and Pokémon cards", checked: "Every 2 minutes", status: "live" },
  { name: "MySlabs", url: "https://myslabs.com", what: "Graded cards and sealed wax", checked: "Every 5 minutes", status: "live" },
  { name: "Collector Crypt", url: "https://collectorcrypt.com", what: "Vaulted graded cards, mostly Pokémon", checked: "Every 5 minutes", status: "live" },
];

const AUCTION_HOUSES: Site[] = [
  { name: "Sotheby's", url: "https://www.sothebys.com", what: "Sports memorabilia and modern collectibles sales", checked: "Hourly", status: "live" },
  { name: "Sirius Sports Cards", url: "https://www.siriussportsauctions.com", what: "Vintage and modern cards, back-to-back auctions", checked: "Every 30 minutes", status: "live" },
  { name: "Sterling Sports Auctions", url: "https://www.sterlingsportsauctions.com", what: "Cards and memorabilia, monthly auctions", checked: "Every 30 minutes", status: "live" },
  { name: "Wheatland Auction Services", url: "https://www.wheatlandauctionservices.com", what: "Vintage and modern cards", checked: "Every 30 minutes", status: "live" },
  { name: "Brockelman Auctions", url: "https://www.brockelmanauctions.com", what: "Vintage cards", checked: "Every 30 minutes", status: "live" },
  { name: "Detroit City Sports", url: "https://auctions.detroitcitysports.com", what: "Game-used memorabilia and cards", checked: "Every 30 minutes", status: "live" },
  { name: "Heritage Auctions", url: "https://sports.ha.com", what: "Read from your own Heritage alert emails", checked: "When an alert email arrives", status: "setup" },
];

const SALES_HISTORY = [
  { name: "Goldin", detail: "Past auction and Buy Now results back to 2012. Prices include the buyer's premium." },
  { name: "Fanatics Collect", detail: "Past auction and Buy Now results. Prices include the buyer's premium." },
  { name: "Sirius Sports Cards", detail: "Final prices from more than 400 past auctions." },
];

function StatusDot({ status }: { status: Status }) {
  return status === "live" ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-signal">
      <span className="h-1.5 w-1.5 rounded-full bg-signal" />
      Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-muted" />
      In Development
    </span>
  );
}

function SiteList({ sites }: { sites: Site[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
      {sites.map((s) => (
        <li key={s.name} className="flex items-start justify-between gap-4 px-4 py-3.5">
          <div className="min-w-0">
            <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold hover:text-signal">
              {s.name}
            </a>
            <div className="mt-0.5 text-sm text-muted">{s.what}</div>
          </div>
          <div className="shrink-0 pt-0.5">
            <StatusDot status={s.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AboutPage() {
  const live = [...MARKETPLACES, ...AUCTION_HOUSES].filter((s) => s.status === "live").length;
  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <header className="mb-10 flex items-center justify-between">
        <Wordmark />
        <Link href="/" className="text-sm text-muted hover:text-text">Home</Link>
      </header>

      <h1 className="text-3xl font-bold tracking-tight">One search. Every site.</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        GrailFindr watches marketplaces and auction houses for the cards you&apos;re hunting and alerts you the moment one is
        listed. You save a search once; we check it against {live} sites, with more being added. Every alert links
        straight to the listing on the seller&apos;s own site.
      </p>

      <h2 className="mb-3 mt-10 text-xs font-semibold uppercase tracking-wider text-muted">Marketplaces</h2>
      <SiteList sites={MARKETPLACES} />

      <h2 className="mb-3 mt-10 text-xs font-semibold uppercase tracking-wider text-muted">Auction houses</h2>
      <SiteList sites={AUCTION_HOUSES} />

      <h2 className="mb-3 mt-10 text-xs font-semibold uppercase tracking-wider text-muted">Sold prices</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
        {SALES_HISTORY.map((s) => (
          <li key={s.name} className="px-4 py-3.5">
            <div className="font-semibold">{s.name}</div>
            <div className="mt-0.5 text-sm text-muted">{s.detail}</div>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm leading-relaxed text-muted">
        Every alert links straight to the listing on the seller&apos;s own site. GrailFindr doesn&apos;t sell cards or handle
        payments. Want a site added? Email{" "}
        <a href="mailto:support@grailfindr.com" className="text-signal">support@grailfindr.com</a>.
      </p>
    </main>
  );
}
