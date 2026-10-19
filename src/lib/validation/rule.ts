import { z } from "zod";
import { COMMENT_REPLY_MAX_CHARS, DM_BUTTON_TITLE_MAX, DM_MAX_CHARS } from "@/lib/constants";

export const MATCH_MODES = ["word", "exact", "contains", "any"] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

export const MATCH_MODE_INFO: Record<MatchMode, { label: string; help: string; example: string }> = {
  word: {
    label: "Whole word",
    help: "The keyword appears as a separate word anywhere in the comment.",
    example: '"link" matches "send me the link pls" but not "linked"',
  },
  exact: {
    label: "Exact comment",
    help: "The whole comment equals the keyword (ignoring case, accents, spaces and punctuation).",
    example: '"link" matches "Link!" but not "link please"',
  },
  contains: {
    label: "Contains",
    help: "The keyword appears anywhere, even inside another word.",
    example: '"link" matches "linkedin" and "unlink"',
  },
  any: {
    label: "Any comment",
    help: "Replies to every comment, no keywords needed. Replies inside a comment thread are ignored, and keyword rules in the same campaign tier take precedence.",
    example: '"nice post!" and "🔥" both match',
  },
};

/** Modes that need at least one keyword (everything except `any`). */
export function modeNeedsKeywords(mode: MatchMode): boolean {
  return mode !== "any";
}

export const keywordSchema = z
  .string()
  .trim()
  .min(1, "Keyword can't be empty")
  .max(50, "Keywords are at most 50 characters");

const optionalText = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .max(max, msg)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const ruleSchema = z
  .object({
    name: z.string().trim().min(1, "Give the rule a name").max(80, "At most 80 characters"),
    keywords: z
      .array(keywordSchema)
      .max(50, "At most 50 keywords per rule")
      .transform((list) => {
        const seen = new Set<string>();
        return list.filter((k) => {
          const key = k.toLocaleLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }),
    matchMode: z.enum(MATCH_MODES),
    publicReplies: z
      .array(z.string().trim().max(COMMENT_REPLY_MAX_CHARS, `At most ${COMMENT_REPLY_MAX_CHARS} characters`))
      .max(10, "At most 10 variants")
      .transform((list) => list.filter(Boolean)),
    dmMessage: z
      .string()
      .trim()
      .min(1, "Write the DM message")
      .max(DM_MAX_CHARS, `Instagram allows at most ${DM_MAX_CHARS} characters`),
    dmButtonTitle: optionalText(DM_BUTTON_TITLE_MAX, `At most ${DM_BUTTON_TITLE_MAX} characters`),
    dmButtonUrl: z
      .union([z.url({ protocol: /^https?$/, message: "Enter a valid http(s) URL" }), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    oncePerUser: z.boolean(),
    priority: z.coerce.number().int("Whole numbers only").min(-1000).max(1000),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (modeNeedsKeywords(v.matchMode) && v.keywords.length === 0) {
      ctx.addIssue({ code: "custom", path: ["keywords"], message: "Add at least one keyword" });
    }
    if (v.dmButtonTitle && !v.dmButtonUrl) {
      ctx.addIssue({ code: "custom", path: ["dmButtonUrl"], message: "Add a URL for the button" });
    }
    if (v.dmButtonUrl && !v.dmButtonTitle) {
      ctx.addIssue({ code: "custom", path: ["dmButtonTitle"], message: "Add a button title" });
    }
  });

export type RuleInput = z.input<typeof ruleSchema>;
export type RuleData = z.output<typeof ruleSchema>;

export const testCommentSchema = z.object({
  text: z.string().trim().min(1, "Type a comment to test").max(2200),
  username: z.string().trim().max(64).optional(),
  /** Simulate a reply inside a comment thread (`any` rules ignore those). */
  isReply: z.boolean().optional(),
});

/** Split raw keyword input on commas / newlines (used by the chips input when pasting). */
export function splitKeywords(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
