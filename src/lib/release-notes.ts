/**
 * Tiny, safe parser for release-please release bodies (GitHub-flavoured Markdown). It does not
 * render HTML: it returns plain data (sections → items → links) that the UI turns into React
 * elements, so nothing from the release body is ever injected as markup.
 *
 * Supported shape (what release-please writes):
 *
 *   ## [0.3.0](https://github.com/o/r/compare/v0.2.0...v0.3.0) (2026-10-15)
 *   ### Features
 *   * **scope:** text ([#43](https://github.com/o/r/issues/43)) ([c296db2](https://github.com/o/r/commit/c296db2)), closes [#42](...)
 *
 * Level-1/2 headings (the version line) are dropped — the UI shows the release name already.
 * Level-3+ headings start a section. Bullets and plain lines become items; indented lines
 * continue the previous item. Links are pulled out of the text; only `https://github.com/`
 * links are kept.
 */

export type ReleaseNoteLink = { label: string; href: string };
export type ReleaseNoteItem = { text: string; links: ReleaseNoteLink[] };
export type ReleaseNoteSection = { title: string | null; items: ReleaseNoteItem[] };
export type ReleaseNotes = { sections: ReleaseNoteSection[]; truncated: boolean };

const MAX_SECTIONS = 8;
const MAX_ITEMS_PER_SECTION = 15;
const MAX_TEXT = 300;
const MAX_LABEL = 40;
const MAX_LINKS_PER_ITEM = 6;
const ALLOWED_LINK_PREFIX = "https://github.com/";

// [label](url) — label without brackets, url without whitespace (one level of balanced parens).
const LINK = /\[([^\]\n]*)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;

/** Keep only well-formed https://github.com/ URLs. */
export function isAllowedLink(href: string): boolean {
  if (!href.startsWith(ALLOWED_LINK_PREFIX)) return false;
  try {
    const u = new URL(href);
    return u.protocol === "https:" && u.hostname === "github.com" && !u.username && !u.password;
  } catch {
    return false;
  }
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Drops anything between angle brackets, nested ones included (`<<script>script>` leaves nothing),
 * so no tag-like text survives. A scanner instead of a regex: regex tag stripping is easy to bypass.
 */
export function stripTags(text: string): string {
  let out = "";
  let depth = 0;
  for (const ch of text) {
    if (ch === "<") depth++;
    else if (ch === ">") depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out;
}

/** Strip inline Markdown emphasis/code markers and any HTML; keep the words. */
function stripInline(text: string): string {
  return stripTags(text)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")

    .replace(/\s+/g, " ")
    .trim();
}

export function parseInline(raw: string): ReleaseNoteItem {
  const links: ReleaseNoteLink[] = [];
  const seen = new Set<string>();
  const withoutLinks = raw.replace(LINK, (_m, label: string, href: string) => {
    const cleanLabel = clip(stripInline(label), MAX_LABEL);
    if (isAllowedLink(href) && cleanLabel && !seen.has(href) && links.length < MAX_LINKS_PER_ITEM) {
      seen.add(href);
      links.push({ label: cleanLabel, href });
    }
    return "";
  });
  let text = stripInline(withoutLinks);
  // Remove the scaffolding release-please leaves around the links: "()", ", closes", trailing commas.
  let prev: string;
  do {
    prev = text;
    text = text
      .replace(/\(\s*\)/g, "")
      .replace(/[\s,]*\b(?:closes|fixes|resolves|refs)\b[\s,]*$/i, "")
      .replace(/[\s,]+$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  } while (text !== prev);
  return { text: clip(text, MAX_TEXT), links };
}

export function parseReleaseNotes(body: string | null | undefined): ReleaseNotes {
  const sections: ReleaseNoteSection[] = [];
  let truncated = false;
  let current: ReleaseNoteSection | null = null;
  let lastRaw: string | null = null; // raw text of the item being built (for continuation lines)

  const flushItem = () => {
    if (lastRaw === null || !current) return;
    const item = parseInline(lastRaw);
    lastRaw = null;
    if (!item.text && item.links.length === 0) return;
    if (current.items.length >= MAX_ITEMS_PER_SECTION) {
      truncated = true;
      return;
    }
    current.items.push(item);
  };
  const ensureSection = (title: string | null) => {
    if (sections.length >= MAX_SECTIONS) {
      truncated = true;
      current = null;
      return;
    }
    current = { title, items: [] };
    sections.push(current);
  };

  const lines = (body ?? "").replace(/\r\n?/g, "\n").split("\n");
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      flushItem();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushItem();
      const level = heading[1]?.length ?? 1;
      if (level <= 2) {
        current = null;
        continue;
      }
      const title = clip(stripInline((heading[2] ?? "").replace(LINK, "$1")), 80);
      ensureSection(title || null);
      continue;
    }

    if (!line.trim()) {
      flushItem();
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushItem(); // horizontal rule
      continue;
    }

    const bullet = /^\s{0,3}(?:[*+-]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      flushItem();
      if (!current) ensureSection(null);
      if (!current) continue; // section cap reached
      lastRaw = bullet[1] ?? "";
      continue;
    }

    if (lastRaw !== null && /^\s+\S/.test(line)) {
      lastRaw += ` ${line.trim()}`; // continuation of the previous bullet
      continue;
    }
    if (lastRaw !== null) {
      lastRaw += ` ${line.trim()}`; // paragraph continuation
      continue;
    }
    if (!current) ensureSection(null);
    if (!current) continue;
    lastRaw = line.trim();
  }
  flushItem();

  return { sections: sections.filter((s) => s.items.length > 0), truncated };
}
