/**
 * Text normalization for keyword matching. Pure and isomorphic (no `server-only`), so the UI's
 * "test a comment" simulator can use it too.
 *
 * Pipeline: NFKC (folds stylized letters like "𝐃𝐑𝐈𝐕𝐄" and full-width forms) → strip combining
 * marks (diacritics: "café" → "cafe") → lowercase → fold a few non-decomposable letters → replace
 * every run of non-letter/non-number characters (punctuation, emoji, symbols, whitespace) with a
 * single space → trim.
 */

const LETTER_FOLDS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
  ı: "i",
};
const LETTER_FOLDS_RE = new RegExp(`[${Object.keys(LETTER_FOLDS).join("")}]`, "gu");

/** Normalizes text into space-separated lowercase word tokens. Returns "" for emoji-only text. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/\p{Mn}+/gu, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(LETTER_FOLDS_RE, (c) => LETTER_FOLDS[c] ?? c)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Normalization for symbol/emoji-only keywords (e.g. "🔥"): drops whitespace, punctuation,
 * variation selectors, zero-width joiners and skin-tone modifiers so "🔥️" and "🔥 !" compare equal.
 */
export function normalizeSymbols(input: string): string {
  return input.normalize("NFKC").replace(/[\s\p{P}︎️‍\u{1F3FB}-\u{1F3FF}]+/gu, "");
}

/** Removes `@mentions` (Instagram usernames: letters, digits, `.` and `_`). */
export function stripMentions(input: string): string {
  return input.replace(/(^|[^\w.])@[\w.]+/gu, "$1 ");
}
