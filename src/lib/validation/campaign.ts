import { z } from "zod";

const optionalIsoDate = z
  .union([z.iso.datetime({ offset: true }), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

/** Most posts one campaign may target (form, server action, "Add this post to campaign"). */
export const MAX_CAMPAIGN_MEDIA = 20;

/** An Instagram media id (numeric in practice; kept loose but URL/SQL-safe). */
export const mediaIdSchema = z
  .string()
  .trim()
  .min(1, "Media id can't be empty")
  .max(64, "At most 64 characters")
  .regex(/^[\w-]+$/, "Only letters, digits, - and _");

export const campaignSchema = z
  .object({
    name: z.string().trim().min(1, "Give the campaign a name").max(100, "At most 100 characters"),
    description: z.string().trim().max(500, "At most 500 characters").optional().default(""),
    target: z.enum(["media", "all"]),
    /** Every targeted post (source of truth). The first one is mirrored to `media_id`. */
    mediaIds: z
      .array(mediaIdSchema)
      .max(MAX_CAMPAIGN_MEDIA, `At most ${MAX_CAMPAIGN_MEDIA} posts per campaign`)
      .optional()
      .nullable(),
    /** Legacy single post; used only when `mediaIds` is not sent. */
    mediaId: z.string().trim().max(64).optional().nullable(),
    mediaPermalink: z.url().max(2048).optional().nullable().or(z.literal("")),
    mediaThumbnailUrl: z.url().max(4096).optional().nullable().or(z.literal("")),
    mediaCaption: z.string().max(2200).optional().nullable(),
    isActive: z.boolean().default(true),
    startsAt: optionalIsoDate,
    endsAt: optionalIsoDate,
  })
  .transform((v) => {
    const ids = v.mediaIds ?? (v.mediaId ? [v.mediaId] : []);
    return { ...v, mediaIds: v.target === "media" ? [...new Set(ids)] : [] };
  })
  .superRefine((v, ctx) => {
    if (v.target === "media" && v.mediaIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["mediaIds"], message: "Pick at least one post or reel" });
    }
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after start" });
    }
  });

export type CampaignInput = z.input<typeof campaignSchema>;
export type CampaignData = z.output<typeof campaignSchema>;

/** "Add this post to campaign" from the Skipped comments page. */
export const addCampaignMediaSchema = z.object({
  campaignId: z.uuid(),
  deliveryId: z.uuid(),
});
export type AddCampaignMediaInput = z.infer<typeof addCampaignMediaSchema>;
