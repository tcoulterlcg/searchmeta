import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 2, 2026">
      <p>
        Grailio (&quot;we&quot;, &quot;us&quot;) lets collectors save searches and get notified when a matching item is
        listed on supported marketplaces and auction houses. This policy explains what we collect and why.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account:</b> your email address and an encrypted password, used to sign you in.</li>
        <li><b>Saved searches:</b> the keywords and filters you create, used to find matching listings.</li>
        <li><b>Alerts:</b> the listings that matched your searches, whether you&apos;ve seen them, and which ones you&apos;re watching.</li>
        <li><b>Device tokens:</b> a push token for each phone or browser where you turn on notifications, used only to deliver alerts.</li>
        <li><b>Forwarded emails (optional):</b> if you forward auction-house alert emails to your Grailio address, we read them to find listings, keep a short excerpt so you can see what arrived, and discard the rest.</li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t sell your data or share it with advertisers.</li>
        <li>We don&apos;t track you across other apps or websites.</li>
        <li>We don&apos;t handle payments. Purchases happen on the seller&apos;s own site.</li>
      </ul>

      <h2>Services we use</h2>
      <ul>
        <li>Supabase: database and sign-in</li>
        <li>Vercel: hosting</li>
        <li>Expo / Apple / Google: delivering push notifications</li>
        <li>Postmark: receiving forwarded emails (only if you use that feature)</li>
      </ul>

      <h2>Links to other sites</h2>
      <p>
        Alerts link to listings on third-party sites such as eBay, Goldin, and Fanatics Collect. Their own privacy policies
        apply when you visit them. Some links may be affiliate links.
      </p>

      <h2>Deleting your data</h2>
      <p>
        You can delete saved searches at any time. To delete your account and everything tied to it, choose{" "}
        <b>Delete account</b> at the bottom of Settings; it takes effect straight away. You can also email{" "}
        <a href="mailto:support@grailio.app">support@grailio.app</a> from the address you signed up with, and we&apos;ll
        delete it within 30 days.
      </p>

      <h2>Children</h2>
      <p>Grailio is not directed to children under 13, and we don&apos;t knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>If we change this policy, we&apos;ll update the date above and, for significant changes, notify you in the app.</p>

      <h2>Contact</h2>
      <p><a href="mailto:support@grailio.app">support@grailio.app</a></p>
    </LegalPage>
  );
}
