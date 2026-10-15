/** Cutoff instant for retention: rows created before it are purged. Null when keeping forever. */
export function retentionCutoff(days: number, now: Date): Date | null {
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function retentionLabel(days: number): string {
  return days === 0 ? "Keep forever" : days === 365 ? "1 year (365 days)" : `${days} days`;
}
