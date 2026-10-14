/**
 * Message templating. Pure and isomorphic (no `server-only`) so the UI can preview messages.
 */

export interface TemplateVars {
  username?: string | null;
  keyword?: string | null;
}

const VARIABLE_RE = /\{\s*(username|keyword)\s*\}/gi;

/**
 * Replaces `{username}` and `{keyword}` (case-insensitive, whitespace inside braces allowed).
 * Missing values render as "" and the resulting doubled spaces/space-before-punctuation are
 * tidied ("Hi {username}!" with no username → "Hi!"). Other braces are left untouched.
 */
export function renderTemplate(tpl: string, vars: TemplateVars): string {
  let missing = false;
  const out = tpl.replace(VARIABLE_RE, (_m, name: string) => {
    const value = name.toLowerCase() === "username" ? vars.username : vars.keyword;
    if (value === undefined || value === null || value === "") {
      missing = true;
      return "";
    }
    return value;
  });
  if (!missing) return out;
  return out
    .replace(/@(?=[\s,.!?]|$)/g, "") // dangling "@" from "@{username}"
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.!?;:])/g, "$1")
    .replace(/^[ \t]+|[ \t]+$/gm, "");
}

/** Truncates to `max` Unicode code points (never splits a surrogate pair), adding "…" if cut. */
export function truncateText(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  if (max <= 1) return chars.slice(0, max).join("");
  return `${chars
    .slice(0, max - 1)
    .join("")
    .trimEnd()}…`;
}

/** Picks a random element (uniform). Returns `undefined` for an empty list. */
export function pickRandom<T>(items: readonly T[], random: () => number = Math.random): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.min(Math.floor(random() * items.length), items.length - 1)];
}
