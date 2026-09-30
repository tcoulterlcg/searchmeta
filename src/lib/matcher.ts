import { matchesQuery, parseQuery, prepareText, type CompiledQuery } from "./query";
import type { ListingInput, SavedSearch } from "./types";

const GRADED_RE = /\b(psa|bgs|sgc|cgc|csg|hga|beckett|graded)\b/i;

export function isGraded(listing: ListingInput): boolean {
  if (typeof listing.graded === "boolean") return listing.graded;
  return GRADED_RE.test(listing.title);
}

interface IndexedSearch {
  search: SavedSearch;
  query: CompiledQuery;
}

/**
 * Holds every active saved search, indexed by an "anchor" word so each new
 * listing only gets checked against searches that could possibly match it.
 */
export class SearchIndex {
  private byAnchor = new Map<string, IndexedSearch[]>();
  private unanchored: IndexedSearch[] = [];

  constructor(searches: SavedSearch[]) {
    for (const search of searches) {
      const query = parseQuery(search.keywords);
      if (query.clauses.length === 0) continue;
      const entry = { search, query };
      if (query.anchor) {
        const list = this.byAnchor.get(query.anchor) ?? [];
        list.push(entry);
        this.byAnchor.set(query.anchor, list);
      } else {
        this.unanchored.push(entry);
      }
    }
  }

  match(listing: ListingInput): SavedSearch[] {
    const titleText = prepareText(listing.title);
    const fullText = listing.description
      ? prepareText(`${listing.title} ${listing.description}`)
      : titleText;

    const candidates = new Set<IndexedSearch>(this.unanchored);
    for (const word of fullText.set) {
      const list = this.byAnchor.get(word);
      if (list) for (const e of list) candidates.add(e);
    }

    const hits: SavedSearch[] = [];
    for (const { search, query } of candidates) {
      const text = search.search_description ? fullText : titleText;
      if (!matchesQuery(query, text)) continue;
      if (!passesFilters(search, listing)) continue;
      hits.push(search);
    }
    return hits;
  }
}

export function passesFilters(s: SavedSearch, l: ListingInput): boolean {
  if (s.sources.length > 0 && !s.sources.includes(l.source)) return false;
  if (s.min_price != null && (l.price == null || l.price < s.min_price)) return false;
  if (s.max_price != null && (l.price == null || l.price > s.max_price)) return false;
  if (s.buying_formats.length > 0 && !s.buying_formats.some((f) => l.buying_formats.includes(f))) return false;
  if (s.condition === "graded" && !isGraded(l)) return false;
  if (s.condition === "ungraded" && isGraded(l)) return false;
  if (s.free_shipping && l.free_shipping === false) return false;
  if (s.located_in && l.location_country && l.location_country !== s.located_in) return false;
  return true;
}
