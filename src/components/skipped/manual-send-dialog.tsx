"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError } from "@/components/field-error";
import { COMMENT_REPLY_MAX_CHARS, DM_MAX_CHARS } from "@/lib/constants";
import { skipReasonLabel } from "@/lib/labels";
import { manualSendSchema, type ManualSendInput } from "@/lib/validation/skipped";
import { manualKeyword, previewSend } from "@/server/engine/manual";
import type { MatchMode } from "@/server/engine/match";
import { manualSendAction } from "@/app/(dashboard)/skipped/actions";

/** A rule offered for manual send (serialisable subset of the DB row). */
export interface ManualRuleOption {
  id: string;
  name: string;
  campaignName: string;
  keywords: string[];
  matchMode: MatchMode;
  publicReplies: string[];
  dmMessage: string;
  dmButtonTitle: string | null;
  dmButtonUrl: string | null;
  oncePerUser: boolean;
}

export function ManualSendButton({
  deliveryId,
  username,
  commentText,
  rules,
  preselectedRuleId,
  disabledReason,
}: {
  deliveryId: string;
  username: string | null;
  commentText: string | null;
  rules: ManualRuleOption[];
  preselectedRuleId: string | null;
  /** Why this row can't be sent (e.g. older than 7 days); disables the button and is shown next to it. */
  disabledReason: string | null;
}) {
  const [open, setOpen] = useState(false);
  const reasonId = useId();
  const blocked = disabledReason ?? (rules.length === 0 ? "No active rule applies to this post." : null);
  const handle = username ? `@${username}` : "this commenter";

  return (
    <div className="grid justify-items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!!blocked}
        aria-describedby={blocked ? reasonId : undefined}
        onClick={() => setOpen(true)}
      >
        <Send aria-hidden /> Send manually
        <span className="sr-only"> to {handle}</span>
      </Button>
      {blocked ? (
        <p id={reasonId} className="text-muted-foreground max-w-56 text-xs">
          {blocked}
        </p>
      ) : null}
      {open ? (
        <ManualSendDialog
          open={open}
          onOpenChange={setOpen}
          deliveryId={deliveryId}
          handle={handle}
          username={username}
          commentText={commentText}
          rules={rules}
          preselectedRuleId={preselectedRuleId}
        />
      ) : null}
    </div>
  );
}

function ManualSendDialog({
  open,
  onOpenChange,
  deliveryId,
  handle,
  username,
  commentText,
  rules,
  preselectedRuleId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryId: string;
  handle: string;
  username: string | null;
  commentText: string | null;
  rules: ManualRuleOption[];
  preselectedRuleId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;
  const initialRule = rules.some((r) => r.id === preselectedRuleId) ? preselectedRuleId : null;

  const { control, handleSubmit, setError, formState } = useForm<ManualSendInput>({
    resolver: zodResolver(manualSendSchema),
    defaultValues: { deliveryId, ruleId: initialRule ?? "", ignoreOncePerUser: false },
  });
  const ruleId = useWatch({ control, name: "ruleId" });
  const rule = rules.find((r) => r.id === ruleId);
  const preview = rule
    ? previewSend(
        rule,
        { username, keyword: manualKeyword(commentText, rule) },
        { commentMax: COMMENT_REPLY_MAX_CHARS, dmMax: DM_MAX_CHARS },
      )
    : null;
  const ruleError = formState.errors.ruleId?.message;

  const onSubmit = handleSubmit((values) =>
    start(async () => {
      setFormError(null);
      const res = await manualSendAction(values);
      if (!res.ok) {
        const fieldMsg = res.fieldErrors?.ruleId?.[0];
        if (fieldMsg) setError("ruleId", { type: "server", message: fieldMsg });
        else setFormError(res.error);
        toast.error(res.error);
        router.refresh();
        return;
      }
      const { status, error, skipReason } = res.data;
      if (status === "sent") toast.success(`Sent to ${handle}`);
      else if (status === "partial")
        toast.warning(`Partly sent to ${handle}`, { description: error ?? undefined });
      else if (status === "skipped") {
        const msg = `Not sent: ${skipReasonLabel(skipReason)}`;
        setFormError(msg);
        toast.info(msg);
        router.refresh();
        return;
      } else {
        const msg = `Sending failed${error ? `: ${error}` : ""}`;
        toast.error(msg);
        onOpenChange(false);
        router.refresh();
        return;
      }
      onOpenChange(false);
      router.refresh();
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="break-words">Send manually to {handle}?</DialogTitle>
          <DialogDescription>
            Posts the rule&apos;s public reply and sends its DM as a private reply to this comment. Instagram
            allows one private reply per comment, so this can only be done once.
          </DialogDescription>
        </DialogHeader>

        <form id={f("form")} noValidate onSubmit={onSubmit} className="grid gap-4">
          {commentText ? (
            <blockquote className="bg-muted rounded-md px-3 py-2 text-sm break-words">
              {commentText}
            </blockquote>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor={f("rule")}>Rule to send</Label>
            <Controller
              control={control}
              name="ruleId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger
                    id={f("rule")}
                    className="w-full"
                    aria-invalid={!!ruleError}
                    aria-describedby={[f("rule-help"), ruleError ? f("rule-error") : null]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <SelectValue placeholder="Choose a rule" />
                  </SelectTrigger>
                  <SelectContent>
                    {rules.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.campaignName} · {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p id={f("rule-help")} className="text-muted-foreground text-xs">
              {initialRule
                ? "Pre-selected: the rule this comment matches now."
                : "No rule matches this comment's text now; pick the one to send."}
            </p>
            <FieldError id={f("rule-error")} errors={ruleError ? [ruleError] : undefined} />
          </div>

          {preview ? (
            <section aria-label="Preview" className="grid gap-3 rounded-md border p-3 text-sm">
              <div className="grid gap-1">
                <h3 className="text-muted-foreground text-xs font-medium">
                  Public reply{preview.publicReplies.length > 1 ? " (one picked at random)" : ""}
                </h3>
                {preview.publicReplies.length ? (
                  <ul className="grid gap-1">
                    {preview.publicReplies.map((r, i) => (
                      <li key={i} className="break-words whitespace-pre-wrap">
                        {r}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground italic">None</p>
                )}
              </div>
              <div className="grid gap-1">
                <h3 className="text-muted-foreground text-xs font-medium">DM</h3>
                {preview.dm ? (
                  <p className="break-words whitespace-pre-wrap">{preview.dm}</p>
                ) : (
                  <p className="text-muted-foreground italic">None</p>
                )}
                {preview.button ? (
                  <p className="text-muted-foreground text-xs break-all">
                    Button “{preview.button.title}” → {preview.button.url}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {rule?.oncePerUser ? (
            <div className="grid gap-1">
              <div className="flex items-start gap-2">
                <Controller
                  control={control}
                  name="ignoreOncePerUser"
                  render={({ field }) => (
                    <Checkbox
                      id={f("ignore-once")}
                      checked={!!field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      aria-describedby={f("ignore-once-help")}
                      className="mt-0.5"
                    />
                  )}
                />
                <Label htmlFor={f("ignore-once")} className="leading-snug font-normal">
                  Send even if {handle} already got this rule&apos;s DM
                </Label>
              </div>
              <p id={f("ignore-once-help")} className="text-muted-foreground pl-6 text-xs">
                This rule has “Once per user” on. Leave this off to respect it.
              </p>
            </div>
          ) : null}

          {formError ? (
            <p role="alert" className="text-destructive text-sm break-words">
              {formError}
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={f("form")} disabled={pending} aria-busy={pending || undefined}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {pending ? "Sending…" : "Send now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
