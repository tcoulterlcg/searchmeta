import Link from "next/link";
import { Bricolage_Grotesque } from "next/font/google";

const wordmarkFont = Bricolage_Grotesque({ subsets: ["latin"], weight: ["300", "800"], display: "swap" });

/** Converge mark: four sources flowing into one alert. Lines use the current text color. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M8 12C28 12 26 32 44 32" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M8 25C24 25 28 32 44 32" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M8 39C24 39 28 32 44 32" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M8 52C28 52 26 32 44 32" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="50" cy="32" r="9" fill="#3ef08a" />
    </svg>
  );
}

/** Logo + name. Always links home (signed-in users land on Alerts). */
export function Wordmark() {
  return (
    <Link
      href="/"
      aria-label="SearchMeta home"
      className={`${wordmarkFont.className} flex w-fit items-center gap-2 text-xl font-light tracking-tight`}
    >
      <Logo />
      <span>
        search<span className="font-extrabold">meta</span>
      </span>
    </Link>
  );
}
