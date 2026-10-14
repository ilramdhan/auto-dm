import { z } from "zod";
import { isValidTimeZone } from "@/lib/timezone";

export const metaAppSchema = z.object({
  appId: z
    .string()
    .trim()
    .regex(/^\d{5,25}$/, "The App ID is a number (5–25 digits)"),
  /** Write-only: blank keeps the stored secret. */
  appSecret: z
    .string()
    .trim()
    .refine((v) => v === "" || (v.length >= 16 && v.length <= 128), "The App Secret is 16–128 characters")
    .optional()
    .default(""),
});

export const processingSchema = z.object({
  mode: z.enum(["webhook", "n8n"]),
  enabled: z.boolean(),
});

export const timeZoneSchema = z.object({
  timeZone: z.string().trim().refine(isValidTimeZone, "Unknown time zone"),
});

export const apiKeyNameSchema = z.object({
  name: z.string().trim().min(1, "Give the key a name").max(60, "At most 60 characters"),
});
