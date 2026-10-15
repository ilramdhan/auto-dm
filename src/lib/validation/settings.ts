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

/** Shown on the public privacy policy and data deletion pages. Also used by the SETTINGS registry. */
export const operatorNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name or business name")
  .max(100, "At most 100 characters");

export const contactEmailSchema = z
  .string()
  .trim()
  .max(254, "At most 254 characters")
  .pipe(z.email("Enter a valid email address"));

export const publicContactSchema = z.object({
  operatorName: operatorNameSchema,
  contactEmail: contactEmailSchema,
});
export type PublicContactInput = z.input<typeof publicContactSchema>;
