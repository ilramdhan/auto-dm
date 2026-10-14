"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMMON_TIME_ZONES, ymdInZone } from "@/lib/timezone";
import { saveTimeZoneAction } from "./actions";

function allTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
  try {
    return intl.supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

/** Time zone used for calendar days in Analytics and "today" on the dashboard. */
export function TimeZoneCard({ timeZone: initial }: { timeZone: string }) {
  const router = useRouter();
  const [timeZone, setTimeZone] = useState(initial);
  const [pending, start] = useTransition();
  const others = useMemo(
    () => allTimeZones().filter((tz) => !(COMMON_TIME_ZONES as readonly string[]).includes(tz)),
    [],
  );
  const browserZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const dirty = timeZone !== initial;
  const preview = useMemo(() => {
    try {
      const now = new Date();
      const time = new Intl.DateTimeFormat(undefined, {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
      }).format(now);
      return `${ymdInZone(now, timeZone)} ${time}`;
    } catch {
      return "";
    }
  }, [timeZone]);

  return (
    <form
      className="max-w-3xl"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveTimeZoneAction({ timeZone });
          if (res.ok) {
            toast.success("Time zone saved", {
              description: "Analytics now group days in " + timeZone + ".",
            });
            router.refresh();
          } else toast.error(res.error);
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4" aria-hidden /> Time zone
          </CardTitle>
          <CardDescription>
            Used to group Analytics by day and to count &ldquo;Comments today&rdquo; on the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Label htmlFor="timezone">Time zone</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={timeZone} onValueChange={setTimeZone}>
              <SelectTrigger id="timezone" className="w-full sm:w-80" aria-describedby="timezone-help">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectGroup>
                  <SelectLabel>Common</SelectLabel>
                  {COMMON_TIME_ZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {others.length > 0 ? (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>All time zones</SelectLabel>
                      {others.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                ) : null}
              </SelectContent>
            </Select>
            {browserZone && browserZone !== timeZone ? (
              <Button type="button" variant="outline" onClick={() => setTimeZone(browserZone)}>
                <LocateFixed aria-hidden /> Use {browserZone}
              </Button>
            ) : null}
          </div>
          <p id="timezone-help" className="text-muted-foreground text-sm">
            Current time there: <span className="text-foreground font-medium tabular-nums">{preview}</span>
          </p>
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
