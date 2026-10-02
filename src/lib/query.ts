/**
 * eBay-style keyword query parsing and matching.
 *
 * Supported syntax (same as eBay search):
 *   kucherov shield        all words must appear (any order)
 *   "logo patch"           exact phrase
 *   -reprint               exclude a word
 *   -"lot of"              exclude a phrase
 *   (psa,bgs,sgc)          any one of these
 *   -(digital,custom)      exclude all of these
 *   kuch*                  word prefix wildcard
 */

export type Clause =
  | { kind: "term"; value: string; wildcard: boolean; neg: boolean }
  | { kind: "phrase"; words: string[]; neg: boolean }
  | { kind: "or"; options: Clause[]; neg: boolean };

export interface CompiledQuery {
  clauses: Clause[];
  /** A required, non-wildcard word used for fast index lookup (null if none). */
  anchor: string | null;
}

export function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    // Keep the point in a half grade ("8.5") so a search for "psa 8" does not match "PSA 8.5".
    .replace(/[^a-z0-9#/*.]+/g, " ")
    .replace(/\.(?!\d)|(?<!\d)\./g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function parseAtom(raw: string, neg: boolean): Clause | null {
  const words = normalize(raw);
  if (words.length === 0) return null;
  if (words.length === 1) {
    const w = words[0];
    const wildcard = w.endsWith("*");
    const value = w.replace(/\*+$/, "");
    if (!value) return null;
    return { kind: "term", value, wildcard, neg };
  }
  return { kind: "phrase", words: words.map((w) => w.replace(/\*/g, "")), neg };
}

export function parseQuery(input: string): CompiledQuery {
  const clauses: Clause[] = [];
  let i = 0;
  const s = input.trim();

  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;

    let neg = false;
    if (s[i] === "-") {
      neg = true;
      i++;
    }

    if (s[i] === '"') {
      const end = s.indexOf('"', i + 1);
      const body = end === -1 ? s.slice(i + 1) : s.slice(i + 1, end);
      i = end === -1 ? s.length : end + 1;
      const words = normalize(body).map((w) => w.replace(/\*/g, ""));
      if (words.length === 1) clauses.push({ kind: "term", value: words[0], wildcard: false, neg });
      else if (words.length > 1) clauses.push({ kind: "phrase", words, neg });
      continue;
    }

    if (s[i] === "(") {
      const end = s.indexOf(")", i + 1);
      const body = end === -1 ? s.slice(i + 1) : s.slice(i + 1, end);
      i = end === -1 ? s.length : end + 1;
      const options = body
        .split(/[,|]/)
        .map((part) => {
          const p = part.trim().replace(/^"|"$/g, "");
          return parseAtom(p, false);
        })
        .filter((c): c is Clause => c !== null);
      if (options.length > 0) clauses.push({ kind: "or", options, neg });
      continue;
    }

    let j = i;
    while (j < s.length && !/\s/.test(s[j]) && s[j] !== "(" && s[j] !== '"') j++;
    const word = s.slice(i, j);
    i = j;
    const atom = parseAtom(word, neg);
    if (atom) {
      // A single token like "1/1" normalizes to one word; "o-pee-chee" becomes a phrase.
      clauses.push(atom);
    }
  }

  const anchor =
    clauses
      .filter((c): c is Extract<Clause, { kind: "term" }> => c.kind === "term" && !c.neg && !c.wildcard)
      .map((c) => c.value)
      .sort((a, b) => b.length - a.length)[0] ??
    clauses
      .filter((c): c is Extract<Clause, { kind: "phrase" }> => c.kind === "phrase" && !c.neg)
      .flatMap((c) => c.words)
      .sort((a, b) => b.length - a.length)[0] ??
    null;

  return { clauses, anchor };
}

export interface PreparedText {
  words: string[];
  set: Set<string>;
  joined: string;
}

export function prepareText(text: string): PreparedText {
  const words = normalize(text).map((w) => w.replace(/\*/g, ""));
  return { words, set: new Set(words), joined: ` ${words.join(" ")} ` };
}

function clauseHits(c: Clause, t: PreparedText): boolean {
  switch (c.kind) {
    case "term":
      return c.wildcard ? t.words.some((w) => w.startsWith(c.value)) : t.set.has(c.value);
    case "phrase":
      return t.joined.includes(` ${c.words.join(" ")} `);
    case "or":
      return c.options.some((o) => clauseHits(o, t));
  }
}

export function matchesQuery(q: CompiledQuery, t: PreparedText): boolean {
  if (q.clauses.length === 0) return false;
  let hasPositive = false;
  for (const c of q.clauses) {
    const hit = clauseHits(c, t);
    if (c.neg) {
      if (hit) return false;
    } else {
      hasPositive = true;
      if (!hit) return false;
    }
  }
  return hasPositive;
}
