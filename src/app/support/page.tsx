import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Support · SearchMeta" };

export default function SupportPage() {
  return (
    <LegalPage title="Support" updated="October 1, 2026">
      <p>
        Questions, bugs, or a site you want us to add? Email{" "}
        <a href="mailto:support@searchmeta.app">support@searchmeta.app</a> and we&apos;ll get back to you.
      </p>

      <h2>How SearchMeta works</h2>
      <p>
        Save a search once and SearchMeta checks eBay, Goldin, Fanatics Collect, MyCardPost, and Sotheby&apos;s for new
        listings that match. When one appears, you get a notification and it shows up in Alerts.
      </p>

      <h2>Search tips</h2>
      <ul>
        <li><b>kucherov shield</b>: all words, any order</li>
        <li><b>&quot;logo patch&quot;</b>: exact phrase</li>
        <li><b>-reprint</b>: exclude a word</li>
        <li><b>(psa,bgs,sgc)</b>: any one of these</li>
        <li><b>kuch*</b>: word starts with</li>
      </ul>

      <h2>Not getting notifications?</h2>
      <ul>
        <li>Check that notifications are allowed for SearchMeta in your phone&apos;s Settings.</li>
        <li>Make sure the saved search has notifications turned on.</li>
        <li>When you first save a search, existing listings show in Alerts without a notification. Only new listings notify you.</li>
      </ul>

      <h2>Delete your account</h2>
      <p>
        Email <a href="mailto:support@searchmeta.app">support@searchmeta.app</a> from your account email and we&apos;ll
        delete your account and data.
      </p>
    </LegalPage>
  );
}
