import type { ListingInput } from "../types";

/**
 * Pulls Heritage lots out of a forwarded Heritage alert email (e.g. a Want List match).
 * Heritage lot pages look like https://www.ha.com/itm/<category>/<slug>/a/<auction>-<lot>.s
 * Links in marketing emails are often wrapped in click-tracking redirects, so we also
 * look for an encoded ha.com/itm URL inside each href.
 */

const LOT_RE = /https?:\/\/(?:www\.)?ha\.com\/itm\/[^\s"'<>]+?\/a\/(\d+-\d+)\.s/i;

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(s: string) {
  return decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Finds a Heritage lot URL in a link, unwrapping tracking redirects. */
export function findLotUrl(href: string): { url: string; lotId: string } | null {
  const candidates = [href];
  try {
    let d = href;
    for (let i = 0; i < 3; i++) {
      d = decodeURIComponent(d);
      candidates.push(d);
    }
  } catch {
    // malformed encoding — ignore
  }
  for (const c of candidates) {
    const m = decodeEntities(c).match(LOT_RE);
    if (m) return { url: m[0].replace(/^http:/, "https:"), lotId: m[1] };
  }
  return null;
}

function titleFromUrl(url: string) {
  const parts = url.split("/itm/")[1]?.split("/") ?? [];
  const slug = parts.length >= 2 ? parts[parts.length - 3] ?? parts[1] : "";
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

export function parseHeritageEmail(html: string, text = ""): ListingInput[] {
  const byLot = new Map<string, ListingInput>();
  const anchorRe = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = anchorRe.exec(html))) {
    const lot = findLotUrl(m[1]);
    if (!lot) continue;
    const inner = m[2];
    const label = stripTags(inner);
    const img = inner.match(/<img\b[^>]*src\s*=\s*["']([^"']+)["']/i)?.[1] ?? null;
    const existing = byLot.get(lot.lotId);

    // Prefer the longest descriptive link text as the title; keep the first image seen.
    const goodLabel = label.length >= 12 && !/^(view|bid|see|click|shop|more)\b/i.test(label) ? label : null;
    const title = goodLabel && (!existing || goodLabel.length > existing.title.length) ? goodLabel : existing?.title;

    byLot.set(lot.lotId, {
      source: "heritage",
      external_id: lot.lotId,
      title: title ?? titleFromUrl(lot.url),
      url: lot.url,
      image_url: existing?.image_url ?? (img ? decodeEntities(img) : null),
      price: null,
      currency: "USD",
      buying_formats: ["auction"],
      graded: null,
      free_shipping: null,
      location_country: "US",
      listed_at: null,
      ends_at: null,
    });
  }

  // Plain-text emails: just collect lot URLs.
  if (byLot.size === 0 && text) {
    const re = new RegExp(LOT_RE.source, "gi");
    let t: RegExpExecArray | null;
    while ((t = re.exec(text))) {
      const lot = findLotUrl(t[0]);
      if (lot && !byLot.has(lot.lotId)) {
        byLot.set(lot.lotId, {
          source: "heritage",
          external_id: lot.lotId,
          title: titleFromUrl(lot.url),
          url: lot.url,
          image_url: null,
          price: null,
          currency: "USD",
          buying_formats: ["auction"],
        });
      }
    }
  }

  return [...byLot.values()];
}
