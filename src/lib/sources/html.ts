/** Small helpers shared by the readers that parse plain HTML pages. */

export const UA = "GrailioBot/1.0 (+https://searchmeta.vercel.app)";

export function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Visible text of an HTML fragment, on one line. */
export const text = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** "$1,234.50" -> 1234.5 */
export function money(s: string | undefined | null): number | null {
  const m = s?.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

export async function getHtml(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned ${res.status}`);
  return res;
}
