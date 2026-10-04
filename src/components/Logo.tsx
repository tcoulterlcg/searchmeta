import Link from "next/link";
import { displayFont } from "@/lib/fonts";

/**
 * Searchlight mark: a "G" with an arrow homing in on the centre, inside a green crosshair.
 * The G and arrow use the current text color, so the mark works on light and dark.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M47.6 16.4A22 22 0 1 0 54 32H37" stroke="currentColor" strokeWidth="8" strokeLinecap="butt" strokeLinejoin="miter" />
      <path d="M38 24.5 25 32l13 7.5Z" fill="currentColor" />
      <circle cx="32" cy="32" r="12.5" stroke="#3ef08a" strokeWidth="3" />
      <path d="M32 2v15M32 47v15M2 32h15" stroke="#3ef08a" strokeWidth="3" strokeLinecap="butt" />
    </svg>
  );
}

/** Logo + name. Always links home (signed-in users land on Alerts). */
export function Wordmark() {
  return (
    <Link
      href="/"
      aria-label="GrailFindr home"
      className={`${displayFont.className} flex w-fit items-center gap-2.5 text-xl uppercase tracking-wide`}
    >
      <Logo />
      <span>
        <span className="font-light">Grail</span>
        <span className="font-extrabold">Findr</span>
      </span>
    </Link>
  );
}
