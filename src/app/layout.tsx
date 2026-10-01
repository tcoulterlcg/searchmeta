import type { Metadata, Viewport } from "next";
import "./globals.css";
import { displayFont } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "SearchMeta",
  description: "One alert for every auction house. Get notified the moment your card is listed on eBay, Goldin, Fanatics Collect, or Heritage.",
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
    <html lang="en" className={displayFont.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
