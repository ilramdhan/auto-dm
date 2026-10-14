import { z } from "zod";

const optionalIsoDate = z
  .union([z.iso.datetime({ offset: true }), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

export const campaignSchema = z
  .object({
    name: z.string().trim().min(1, "Give the campaign a name").max(100, "At most 100 characters"),
    description: z.string().trim().max(500, "At most 500 characters").optional().default(""),
    target: z.enum(["media", "all"]),
    mediaId: z.string().trim().max(64).optional().nullable(),
    mediaPermalink: z.url().max(2048).optional().nullable().or(z.literal("")),
    mediaThumbnailUrl: z.url().max(4096).optional().nullable().or(z.literal("")),
    mediaCaption: z.string().max(2200).optional().nullable(),
    isActive: z.boolean().default(true),
    startsAt: optionalIsoDate,
    endsAt: optionalIsoDate,
  })
  .superRefine((v, ctx) => {
    if (v.target === "media" && !v.mediaId) {
      ctx.addIssue({ code: "custom", path: ["mediaId"], message: "Pick a post or reel" });
    }
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after start" });
    }
  });

export type CampaignInput = z.input<typeof campaignSchema>;
export type CampaignData = z.output<typeof campaignSchema>;
