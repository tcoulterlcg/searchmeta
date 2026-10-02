import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 2, 2026">
      <p>
        These terms cover your use of Grailio (&quot;we&quot;, &quot;us&quot;). By creating an account or using the site
        or app, you agree to them. If you don&apos;t agree, please don&apos;t use Grailio.
      </p>

      <h2>What Grailio does</h2>
      <p>
        Grailio lets you save a search and get alerts when matching items are listed on the marketplaces and auction
        houses we cover, and lets you look up past sale prices. The current list of sites is on the{" "}
        <Link href="/about">About page</Link> and changes over time.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 13 years old, and old enough to enter a contract where you live.</li>
        <li>Keep your password private. You&apos;re responsible for what happens under your account.</li>
        <li>You can delete your account at any time from Settings.</li>
      </ul>

      <h2>Alerts are a convenience, not a guarantee</h2>
      <p>
        We work hard to find listings quickly, but we can&apos;t promise that every listing will be found, that alerts will
        arrive on time, or that details such as price, grade or end time are accurate. A site may change, block us, or be
        unavailable. Always check the listing on the seller&apos;s own site before you bid or buy.
      </p>

      <h2>Buying happens elsewhere</h2>
      <p>
        Grailio doesn&apos;t sell items, hold auctions or handle payments. When you follow an alert, you leave Grailio
        and deal directly with that site under its own terms. We&apos;re not a party to any purchase and aren&apos;t
        responsible for items, sellers, bids, fees, shipping or disputes.
      </p>

      <h2>Sold prices are information only</h2>
      <p>
        Past sale prices come from the sites listed on the About page and may be incomplete or contain errors. They are
        not an appraisal, and nothing on Grailio is financial or investment advice.
      </p>

      <h2>Affiliate links</h2>
      <p>
        Some links to listings may be affiliate links, which means we may earn a commission from the site if you buy. It
        doesn&apos;t change the price you pay or which listings we show you.
      </p>

      <h2>Fair use</h2>
      <ul>
        <li>Don&apos;t use Grailio to break the law or anyone else&apos;s rights.</li>
        <li>Don&apos;t copy our data in bulk, run automated tools against the service, or resell it.</li>
        <li>Don&apos;t try to disrupt the service or get into other people&apos;s accounts.</li>
      </ul>
      <p>We may suspend or close accounts that break these rules.</p>

      <h2>Price</h2>
      <p>
        Grailio is free to use today. If we introduce paid features, we&apos;ll tell you the price before you&apos;re
        charged anything.
      </p>

      <h2>Other companies&apos; names</h2>
      <p>
        Marketplace and auction-house names belong to their owners. Grailio is independent and isn&apos;t endorsed by or
        affiliated with them unless we say so.
      </p>

      <h2>No warranty</h2>
      <p>
        Grailio is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind, to the
        fullest extent the law allows.
      </p>

      <h2>Limit of liability</h2>
      <p>
        To the fullest extent the law allows, we aren&apos;t liable for indirect or consequential losses, or for a missed
        listing, a missed or late alert, or a purchase you did or didn&apos;t make. Our total liability to you is limited
        to the amount you paid us in the 12 months before the claim.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. We&apos;ll change the date above and, for significant changes, tell you in the app. If
        you keep using Grailio after a change, you accept the new terms.
      </p>

      <h2>Contact</h2>
      <p><a href="mailto:support@grailio.app">support@grailio.app</a></p>
    </LegalPage>
  );
}
