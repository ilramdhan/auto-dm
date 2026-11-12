import "server-only";
import { z } from "zod";

/** Opt in per deployment; leaving this unset preserves Instagram Login. */
export function unifiedConfigId(): string | undefined {
  const value = process.env.META_CONFIG_ID;
  if (value === undefined) return undefined;
  return z
    .string()
    .regex(/^\d{5,25}$/, "META_CONFIG_ID must be a numeric configuration ID")
    .parse(value);
}

export const UNIFIED_GRAPH_BASE = "https://graph.facebook.com/v27.0";
