/**
 * Keyword matcher. Pure and isomorphic (no DB, no `server-only`): used by the engine and by the
 * UI's "test a comment" simulator.
 */
import { normalizeSymbols, normalizeText, stripMentions } from "./normalize";

export type MatchMode = "word" | "exact" | "contains";

/** Minimal rule shape needed for matching (a DB `Rule` satisfies it). */
export interface MatchableRule {
  keywords: readonly string[];
  /** Defaults to `word`. */
  matchMode?: MatchMode | null;
  /** Higher wins. Defaults to 0. Ties keep input order. */
  priority?: number | null;
  /** Inactive rules (`false`) are ignored. Undefined/null = active. */
  isActive?: boolean | null;
}

export interface MatchResult<R extends MatchableRule> {
  rule: R;
  /** The keyword as written in the rule (not normalized). */
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
 */
export function keywordMatches(text: string, keyword: string, mode: MatchMode = "word"): boolean {
  return keywordMatchesPrepared(prepare(text), keyword, mode);
}

/**
 * Returns the first matching active rule (highest `priority` first; ties keep input order) and
 * the first of its keywords that matched, or `null`.
 */
export function matchComment<R extends MatchableRule>(
  text: string,
  rules: readonly R[],
): MatchResult<R> | null {
  if (!text || rules.length === 0) return null;
  const prepared = prepare(text);
  const ordered = rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => rule.isActive !== false)
    .sort((a, b) => (b.rule.priority ?? 0) - (a.rule.priority ?? 0) || a.index - b.index);
  for (const { rule } of ordered) {
    const mode = rule.matchMode ?? "word";
    for (const keyword of rule.keywords) {
      if (keyword.trim() && keywordMatchesPrepared(prepared, keyword, mode)) return { rule, keyword };
    }
  }
  return null;
}
