"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power, Webhook, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { saveProcessingAction } from "./actions";

export function ProcessingTab({
  mode: initialMode,
  enabled: initialEnabled,
}: {
  mode: "webhook" | "n8n";
  enabled: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, start] = useTransition();
  const dirty = mode !== initialMode || enabled !== initialEnabled;

  return (
    <form
      className="grid max-w-3xl grid-cols-1 gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveProcessingAction({ mode, enabled });
          if (res.ok) {
            toast.success(enabled ? "Processing settings saved" : "Automation paused", {
              description: enabled ? undefined : "Comments are still logged, but nothing is sent.",
            });
            router.refresh();
          } else toast.error(res.error);
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="size-4" aria-hidden /> Automation
          </CardTitle>
          <CardDescription>Master switch for all replies and DMs.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="grid gap-1">
              <Label htmlFor="processing-enabled">
                {enabled ? "Automation is on" : "Automation is paused"}
              </Label>
              <p id="processing-enabled-help" className="text-muted-foreground text-sm">
                When paused, incoming comments are still recorded in Activity but no reply or DM is sent.
              </p>
            </div>
            <Switch
              id="processing-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-describedby="processing-enabled-help"
            />
          </div>
          {!enabled ? (
            <Alert variant="warning">
              <Power aria-hidden />
              <AlertDescription>
                Kill switch active — nothing will be sent until you turn it back on.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receive comments via</CardTitle>
          <CardDescription>Where Meta sends comment webhooks.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as "webhook" | "n8n")}
            className="grid gap-3 sm:grid-cols-2"
            aria-label="Processing mode"
          >
            {(
              [
                {
                  value: "webhook",
                  title: "Direct webhook",
                  icon: Webhook,
                  desc: "Meta calls this app directly. Simplest and fastest — recommended.",
                },
                {
                  value: "n8n",
                  title: "Through n8n",
                  icon: Workflow,
                  desc: "Meta calls your n8n workflow, which relays events here. Lets you add your own steps.",
                },
              ] as const
            ).map((o) => (
              <Label
                key={o.value}
                htmlFor={`mode-${o.value}`}
                className={cn(
                  "hover:bg-accent/50 flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal transition-colors",
                  mode === o.value && "border-primary bg-primary/5",
                )}
              >
                <RadioGroupItem id={`mode-${o.value}`} value={o.value} className="mt-0.5" />
                <span className="grid gap-1">
                  <span className="flex items-center gap-2 font-medium">
                    <o.icon className="size-4" aria-hidden /> {o.title}
                  </span>
                  <span className="text-muted-foreground text-sm">{o.desc}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
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
