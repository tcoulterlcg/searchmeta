import { Bricolage_Grotesque } from "next/font/google";

/** Brand display font (logo wordmark + headings). */
export const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["300", "600", "700", "800"],
  display: "swap",
  variable: "--font-bricolage",
});
