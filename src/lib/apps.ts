/**
 * Sister apps that share the GrailFindr account (one login, like a Google account).
 * Only apps listed here can receive a sign-in handoff from /connect.
 */
export type SisterApp = {
  id: string;
  name: string;
  tagline: string;
  url: string;
  /** Page on the sister app that finishes the sign-in. */
  handoffPath: string;
};

export const SISTER_APPS: Record<string, SisterApp> = {
  cardhq: {
    id: "cardhq",
    name: "Card HQ",
    tagline: "Set checklists & collection tracker",
    url: "https://cardhq.vercel.app",
    handoffPath: "/auth/grailfindr",
  },
};

/** A same-site path like "/sets/abc" — never a full URL or "//host". */
export function safePath(p: string | null | undefined, fallback = "/"): string {
  if (!p || !p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return fallback;
  return p;
}
