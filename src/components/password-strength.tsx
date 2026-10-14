"use client";

import { passwordStrength } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

const COLORS = ["bg-destructive", "bg-destructive", "bg-warning", "bg-success", "bg-success"];

export function PasswordStrengthMeter({ password, id }: { password: string; id?: string }) {
  const { score, label, hints } = passwordStrength(password);
  return (
    <div id={id} className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              password && i < Math.max(1, score) ? COLORS[score] : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        <span className="text-foreground font-medium">Strength: {password ? label : "—"}</span>
        {hints.length > 0 && password ? <> · {hints[0]}</> : null}
      </p>
    </div>
  );
}
