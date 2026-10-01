import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";

/** Brand voice: logo wordmark and page titles only. */
export const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["300", "700", "800"],
  display: "swap",
  variable: "--font-bricolage",
});

/** Everything else in the interface. */
export const uiFont = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-instrument",
});

/** Search syntax only. */
export const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-jetbrains",
});
