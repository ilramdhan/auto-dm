import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "At least 3 characters")
  .max(32, "At most 32 characters")
  .regex(/^[a-zA-Z0-9._-]+$/, "Letters, numbers, dots, dashes and underscores only");

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username").max(64),
  password: z.string().min(1, "Enter your password").max(256),
  next: z.string().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(256, "At most 256 characters");

/** Forced first-run change (no current password needed: the user just authenticated). */
export const forcedChangePasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    password: newPasswordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => v.password !== v.current, { path: ["password"], message: "Choose a different password" });

export const changeUsernameSchema = z.object({
  username: usernameSchema,
  current: z.string().min(1, "Enter your current password"),
});

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string; hints: string[] };

/** Lightweight, dependency-free strength estimate used for the UI hint. */
export function passwordStrength(pw: string): PasswordStrength {
  const hints: string[] = [];
  if (!pw) return { score: 0, label: "Empty", hints: [`Use at least ${PASSWORD_MIN_LENGTH} characters`] };
  let points = 0;
  if (pw.length >= PASSWORD_MIN_LENGTH) points++;
  else hints.push(`Use at least ${PASSWORD_MIN_LENGTH} characters`);
  if (pw.length >= 16) points++;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes >= 3) points++;
  else hints.push("Mix upper/lower case, numbers and symbols");
  const unique = new Set(pw).size;
  if (unique >= Math.min(10, pw.length * 0.6)) points++;
  else hints.push("Avoid repeated characters");
  if (/^(?:password|changeme|admin|qwerty|123456|letmein)/i.test(pw) || /(.)\1{3,}/.test(pw)) {
    points = Math.max(0, points - 2);
    hints.push("Avoid common words and patterns");
  }
  if (pw.length < PASSWORD_MIN_LENGTH) points = Math.min(points, 1);
  const score = Math.max(0, Math.min(4, points)) as PasswordStrength["score"];
  const label = ["Very weak", "Weak", "Fair", "Good", "Strong"][score]!;
  return { score, label, hints };
}
