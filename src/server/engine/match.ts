/**
 * Keyword matcher. Pure and isomorphic (no DB, no `server-only`): used by the engine and by the
 * UI's "test a comment" simulator.
 */
import { normalizeSymbols, normalizeText, stripMentions } from "./normalize";

export type MatchMode = "word" | "exact" | "contains" | "any";

/**
 * Keyword reported for a rule in `any` mode (stored in `deliveries.matched_keyword`, shown in
 * activity/analytics). Templates should use {@link templateKeyword} so `{keyword}` renders empty.
 * A literal "*" keyword can never match in keyword modes (it normalizes to nothing).
 */
export const ANY_KEYWORD = "*";

/** The value for `{keyword}` in templates: empty for `any`-mode matches, else the keyword. */
export function templateKeyword(keyword: string): string {
  return keyword === ANY_KEYWORD ? "" : keyword;
}

export interface MatchOptions {
  /** The comment is a reply inside a thread (has a parent). `any` rules never match these. */
  isReply?: boolean;
}

/** Minimal rule shape needed for matching (a DB `Rule` satisfies it). */
export interface MatchableRule {
  keywords: readonly string[];
  /** Defaults to `word`. `any` ignores keywords and matches every non-empty top-level comment. */
  matchMode?: MatchMode | null;
  /** Higher wins. Defaults to 0. Ties keep input order. */
  priority?: number | null;
  /** Inactive rules (`false`) are ignored. Undefined/null = active. */
  isActive?: boolean | null;
}

export interface MatchResult<R extends MatchableRule> {
  rule: R;
  /** The keyword as written in the rule (not normalized), or {@link ANY_KEYWORD} for `any` rules. */
  keyword: string;
}

interface PreparedText {
  words: string; // normalized, padded with spaces: " a b c "
  exact: string; // normalized without @mentions
  symbols: string; // symbol-normalized
  exactSymbols: string; // symbol-normalized without @mentions
}

function prepare(text: string): PreparedText {
  const noMentions = stripMentions(text);
  const exact = normalizeText(noMentions);
  return {
    words: ` ${normalizeText(text)} `,
    exact,
    symbols: normalizeSymbols(text),
    // An emoji keyword can only match "exactly" when the comment has no letters/digits at all.
    exactSymbols: exact === "" ? normalizeSymbols(noMentions) : "",
  };
}

function keywordMatchesPrepared(t: PreparedText, keyword: string, mode: MatchMode): boolean {
  const kw = normalizeText(keyword);
  if (kw === "") {
    // Emoji/symbol-only keyword, e.g. "🔥".
    const sym = normalizeSymbols(keyword);
    if (sym === "") return false;
    return mode === "exact" ? t.exactSymbols === sym : t.symbols.includes(sym);
  }
  switch (mode) {
    case "exact":
      return t.exact === kw;
    case "contains":
      return t.words.includes(kw);
    case "any":
      return true;
    case "word":
    default:
      return t.words.includes(` ${kw} `);
  }
}

/**
 * Does `keyword` match `text` under `mode`? Case-, diacritic-, punctuation- and emoji-insensitive.
 * - `word` (default): keyword appears as a whole word/phrase ("drive" ∈ "pls DRIVE 🙏", ∉ "driver").
 * - `exact`: the whole comment (ignoring punctuation, emoji and @mentions) equals the keyword.
 * - `contains`: substring match ("drive" ∈ "googledrive").
 * - `any`: always true (the keyword is irrelevant); use {@link matchComment} for the real rules.
 */
export function keywordMatches(text: string, keyword: string, mode: MatchMode = "word"): boolean {
  return keywordMatchesPrepared(prepare(text), keyword, mode);
}

/**
 * Returns the first matching active rule and the keyword that matched, or `null`.
 *
 * Order: keyword rules (`word`/`exact`/`contains`) are tried first, highest `priority` first, ties
 * keep input order; only if none match are `any` rules tried (same priority/input ordering). So a
 * keyword rule always beats an `any` rule, whatever their priorities. `any` rules match every
 * comment whose text is non-empty after trimming, except thread replies (`opts.isReply`), and
 * report {@link ANY_KEYWORD} as the keyword.
 */
export function matchComment<R extends MatchableRule>(
  text: string,
  rules: readonly R[],
  opts: MatchOptions = {},
): MatchResult<R> | null {
  if (!text || !text.trim() || rules.length === 0) return null;
  const prepared = prepare(text);
  const ordered = rules
    .map((rule, index) => ({ rule, index, isAny: rule.matchMode === "any" }))
    .filter(({ rule }) => rule.isActive !== false)
    .sort(
      (a, b) =>
        Number(a.isAny) - Number(b.isAny) ||
        (b.rule.priority ?? 0) - (a.rule.priority ?? 0) ||
        a.index - b.index,
    );
  for (const { rule, isAny } of ordered) {
    if (isAny) {
      if (opts.isReply) return null; // all remaining rules are `any` too
      return { rule, keyword: ANY_KEYWORD };
    }
    const mode = rule.matchMode ?? "word";
    for (const keyword of rule.keywords) {
      if (keyword.trim() && keywordMatchesPrepared(prepared, keyword, mode)) return { rule, keyword };
    }
  }
  return null;
}
