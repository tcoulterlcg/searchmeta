import type { Metadata, Viewport } from "next";
import "./globals.css";
import { displayFont, uiFont } from "@/lib/fonts";
import { THEME_SCRIPT } from "@/lib/theme";

const DESCRIPTION =
  "Save a search once and get an alert the moment your card is listed on Goldin, Fanatics Collect, MyCardPost, MySlabs and more.";

export const metadata: Metadata = {
  metadataBase: new URL("https://searchmeta.vercel.app"),
  title: { default: "SearchMeta: one saved search, every auction house", template: "%s · SearchMeta" },
  description: DESCRIPTION,
  openGraph: {
    title: "SearchMeta: one saved search, every auction house",
    description: DESCRIPTION,
    siteName: "SearchMeta",
    type: "website",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SearchMeta", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${displayFont.variable} ${uiFont.variable}`}>
      <head>
        {/* Apply the saved theme before paint so there's no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
