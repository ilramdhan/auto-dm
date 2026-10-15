"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DatabaseZap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { retentionLabel } from "@/lib/retention";
import { RETENTION_DAY_OPTIONS, retentionSchema } from "@/lib/validation/settings";
import { saveRetentionAction } from "./actions";

/** How long comment records (the Activity log and its analytics) are kept. */
export function RetentionCard({ retentionDays: initial }: { retentionDays: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = value !== String(initial);

  return (
    <form
      className="max-w-3xl"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = retentionSchema.safeParse({ retentionDays: Number(value) });
        if (!parsed.success) {
          setError("Choose one of the listed options");
          return;
        }
        setError(null);
        start(async () => {
          const res = await saveRetentionAction(parsed.data);
          if (res.ok) {
            toast.success("Data retention saved", {
              description:
                parsed.data.retentionDays === 0
                  ? "Comment records are kept forever."
                  : `Comment records older than ${parsed.data.retentionDays} days will be deleted daily.`,
            });
            router.refresh();
          } else {
            setError(res.fieldErrors?.retentionDays?.[0] ?? res.error);
            toast.error(res.error);
          }
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseZap className="size-4" aria-hidden /> Data retention
          </CardTitle>
          <CardDescription>
            Choose how long comment records are stored. This is also stated on your public privacy policy.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="retention">Keep comment records for</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger
              id="retention"
              className="w-full sm:w-80"
              aria-describedby={error ? "retention-help retention-error" : "retention-help"}
              aria-invalid={error ? true : undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RETENTION_DAY_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {retentionLabel(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p id="retention-help" className="text-muted-foreground text-sm">
            Comment records older than this are deleted automatically every day. Analytics for those days will
            be gone.
          </p>
          {error ? (
            <p id="retention-error" role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          {dirty ? <span className="text-muted-foreground mr-auto text-sm">Unsaved changes</span> : null}
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Save
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
