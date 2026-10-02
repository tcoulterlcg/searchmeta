import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <LegalPage title="Support" updated="October 2, 2026">
      <p>
        Questions, bugs, or a site you want us to add? Email{" "}
        <a href="mailto:support@searchmeta.app">support@searchmeta.app</a> and we&apos;ll get back to you.
      </p>

      <h2>How SearchMeta works</h2>
      <p>
        Save a search once and SearchMeta checks every marketplace and auction house on the{" "}
        <a href="/about">About page</a> for new listings that match. When one appears, you get a notification and it shows
        up in Alerts. Set a search to <b>Daily feed</b> if you&apos;d rather get one summary each morning.
      </p>

      <h2>Search tips</h2>
      <ul>
        <li><b>kucherov shield</b>: all words, any order</li>
        <li><b>&quot;logo patch&quot;</b>: exact phrase</li>
        <li><b>-reprint</b>: exclude a word</li>
        <li><b>(psa,bgs,sgc)</b>: any one of these</li>
        <li><b>kuch*</b>: word starts with</li>
      </ul>

      <h2>Forgot your password?</h2>
      <p>On the sign-in page, choose <b>Forgot password?</b> and we&apos;ll email you a link to set a new one.</p>

      <h2>Not getting notifications?</h2>
      <ul>
        <li>Check that notifications are allowed for SearchMeta in your phone&apos;s Settings.</li>
        <li>Make sure the saved search says <b>Alerts on</b> in Searches.</li>
        <li>When you first save a search, existing listings show in Alerts without a notification. Only new listings notify you.</li>
      </ul>

      <h2>Delete your account</h2>
      <p>
        Go to <b>Settings</b> and choose <b>Delete account</b> at the bottom. Your saved searches and alerts are removed
        straight away. If you can&apos;t sign in, email{" "}
        <a href="mailto:support@searchmeta.app">support@searchmeta.app</a> from your account email and we&apos;ll delete it for you.
      </p>
    </LegalPage>
  );
}
