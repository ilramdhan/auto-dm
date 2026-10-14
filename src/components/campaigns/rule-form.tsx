"use client";

import { useRef, useTransition } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";
import { Info, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError } from "@/components/field-error";
import { DM_BUTTON_TITLE_MAX, DM_MAX_CHARS } from "@/lib/constants";
import { MATCH_MODE_INFO, MATCH_MODES, ruleSchema, type MatchMode } from "@/lib/validation/rule";
import { handleActionResult } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { saveRuleAction } from "@/app/(dashboard)/campaigns/[id]/actions";
import { KeywordInput } from "./keyword-input";

export type RuleFormValues = {
  name: string;
  keywords: string[];
  matchMode: MatchMode;
  publicReplies: { text: string }[];
  dmMessage: string;
  dmButtonTitle: string;
  dmButtonUrl: string;
  oncePerUser: boolean;
  priority: number;
  isActive: boolean;
};

export const EMPTY_RULE: RuleFormValues = {
  name: "",
  keywords: [],
  matchMode: "word",
  publicReplies: [{ text: "Sent you a DM, {username}! 📩" }],
  dmMessage: "Hey {username}! Here's the link you asked for: ",
  dmButtonTitle: "",
  dmButtonUrl: "",
  oncePerUser: true,
  priority: 0,
  isActive: true,
};

function toPayload(v: RuleFormValues) {
  return { ...v, publicReplies: v.publicReplies.map((r) => r.text) };
}

/** Maps a Zod path of the payload to the form field path (replies are wrapped for useFieldArray). */
export function ruleErrorPath(path: readonly PropertyKey[]): string {
  const [head, idx] = path;
  if (head === "publicReplies" && typeof idx === "number") return `publicReplies.${idx}.text`;
  if (head === "keywords") return "keywords";
  return path.map(String).join(".");
}

/** Validates with the shared Zod schema (same one the server action uses). */
const ruleResolver: Resolver<RuleFormValues> = async (values) => {
  const parsed = ruleSchema.safeParse(toPayload(values));
  if (parsed.success) return { values, errors: {} };
  const errors: Record<string, unknown> = {};
  for (const issue of parsed.error.issues) {
    const parts = ruleErrorPath(issue.path).split(".");
    let node = errors;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) node[part] ??= { type: issue.code, message: issue.message };
      else node = (node[part] ??= /^\d+$/.test(parts[i + 1] ?? "") ? [] : {}) as Record<string, unknown>;
    });
  }
  return { values: {}, errors: errors as FieldErrors<RuleFormValues> };
};

const VARIABLES = [
  { token: "{username}", label: "Username" },
  { token: "{keyword}", label: "Keyword" },
];

export function RuleForm({
  campaignId,
  ruleId,
  defaultValues,
  onSaved,
  onCancel,
}: {
  campaignId: string;
  ruleId?: string;
  defaultValues: RuleFormValues;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const uid = ruleId ?? "new";
  const f = (name: string) => `rule-${uid}-${name}`;
  const dmRef = useRef<HTMLTextAreaElement | null>(null);

  const form = useForm<RuleFormValues>({
    defaultValues,
    resolver: ruleResolver,
  });
  const { register, control, handleSubmit, setError, setValue, getValues, formState } = form;
  const errors = formState.errors;
  const replies = useFieldArray({ control, name: "publicReplies" });
  const dm = useWatch({ control, name: "dmMessage" }) ?? "";
  const matchMode = useWatch({ control, name: "matchMode" });
  const dmRegister = register("dmMessage");

  function insertVariable(token: string) {
    const el = dmRef.current;
    const cur = getValues("dmMessage") ?? "";
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? cur.length;
    const next = cur.slice(0, start) + token + cur.slice(end);
    setValue("dmMessage", next, { shouldDirty: true, shouldValidate: formState.isSubmitted });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const res = await saveRuleAction({ campaignId, ruleId, data: toPayload(values) });
      const ok = handleActionResult(res, (name, err) => {
        const path = String(name)
          .replace(/^data\./, "")
          .split(".")
          .map((p) => (/^\d+$/.test(p) ? Number(p) : p));
        setError(ruleErrorPath(path) as never, err);
      });
      if (ok) {
        toast.success(ruleId ? "Rule saved" : "Rule added");
        onSaved();
      }
    });
  });

  const dmCount = [...dm].length;
  const errMsg = (m?: string) => (m ? [m] : undefined);

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-5"
      noValidate
      aria-label={ruleId ? "Edit rule" : "New rule"}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div className="grid gap-2">
          <Label htmlFor={f("name")}>Rule name</Label>
          <Input
            id={f("name")}
            placeholder="e.g. Guide request"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? f("name-error") : undefined}
            {...register("name")}
          />
          <FieldError id={f("name-error")} errors={errMsg(errors.name?.message)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={f("priority")}>Priority</Label>
          <Input
            id={f("priority")}
            type="number"
            inputMode="numeric"
            step={1}
            aria-describedby={f("priority-help")}
            aria-invalid={!!errors.priority}
            {...register("priority", { valueAsNumber: true })}
          />
        </div>
        <p id={f("priority-help")} className="text-muted-foreground -mt-2 text-xs sm:col-span-2">
          When several rules match, the highest priority wins.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={f("keywords")}>Keywords</Label>
        <Controller
          control={control}
          name="keywords"
          render={({ field }) => (
            <KeywordInput
              id={f("keywords")}
              value={field.value}
              onChange={field.onChange}
              invalid={!!errors.keywords}
              describedBy={`${f("keywords-help")}${errors.keywords ? ` ${f("keywords-error")}` : ""}`}
            />
          )}
        />
        <p id={f("keywords-help")} className="text-muted-foreground text-xs">
          Press Enter or comma to add. Matching ignores case and accents; emoji work too.
        </p>
        <FieldError id={f("keywords-error")} errors={errMsg(errors.keywords?.message)} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={f("matchMode")}>Match mode</Label>
        <Controller
          control={control}
          name="matchMode"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id={f("matchMode")}
                className="w-full sm:w-64"
                aria-describedby={f("matchMode-help")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATCH_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MATCH_MODE_INFO[m].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p id={f("matchMode-help")} className="text-muted-foreground flex gap-1.5 text-xs">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            {MATCH_MODE_INFO[matchMode].help}{" "}
            <span className="italic">{MATCH_MODE_INFO[matchMode].example}</span>
          </span>
        </p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Public reply variants</legend>
        <p id={f("replies-help")} className="text-muted-foreground -mt-1 text-xs">
          One is picked at random for each comment (looks more natural). Use <code>{"{username}"}</code> to
          mention the commenter. Leave empty to skip the public reply.
        </p>
        <ul className="grid gap-2">
          {replies.fields.map((field, i) => {
            const err = errors.publicReplies?.[i]?.text?.message;
            return (
              <li key={field.id} className="flex items-start gap-2">
                <div className="grid flex-1 gap-1">
                  <Label htmlFor={f(`reply-${i}`)} className="sr-only">
                    Reply variant {i + 1}
                  </Label>
                  <Input
                    id={f(`reply-${i}`)}
                    placeholder="Check your DMs, {username}!"
                    aria-invalid={!!err}
                    aria-describedby={err ? f(`reply-${i}-error`) : f("replies-help")}
                    {...register(`publicReplies.${i}.text`)}
                  />
                  <FieldError id={f(`reply-${i}-error`)} errors={errMsg(err)} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => replies.remove(i)}
                  aria-label={`Remove reply variant ${i + 1}`}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
        {replies.fields.length < 10 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => replies.append({ text: "" })}
          >
            <Plus aria-hidden /> Add variant
          </Button>
        ) : null}
      </fieldset>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <Label htmlFor={f("dm")}>Direct message</Label>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Insert variable">
            {VARIABLES.map((v) => (
              <Button
                key={v.token}
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => insertVariable(v.token)}
              >
                <Plus className="size-3" aria-hidden />
                {v.label}
              </Button>
            ))}
          </div>
        </div>
        <Textarea
          id={f("dm")}
          rows={5}
          aria-invalid={!!errors.dmMessage}
          aria-describedby={`${f("dm-count")}${errors.dmMessage ? ` ${f("dm-error")}` : ""}`}
          {...dmRegister}
          ref={(el) => {
            dmRegister.ref(el);
            dmRef.current = el;
          }}
        />
        <div className="flex items-start justify-between gap-3">
          <FieldError id={f("dm-error")} errors={errMsg(errors.dmMessage?.message)} />
          <p
            id={f("dm-count")}
            className={cn(
              "text-muted-foreground ml-auto text-xs tabular-nums",
              dmCount > DM_MAX_CHARS && "text-destructive font-medium",
              dmCount > DM_MAX_CHARS * 0.9 && dmCount <= DM_MAX_CHARS && "text-warning",
            )}
            aria-live="polite"
          >
            {dmCount} / {DM_MAX_CHARS}
            <span className="sr-only"> characters</span>
          </p>
        </div>
      </div>

      <fieldset className="grid gap-3 rounded-lg border p-4">
        <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
          <Link2 className="size-4" aria-hidden /> Link button{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={f("btn-title")}>Button title</Label>
            <Input
              id={f("btn-title")}
              placeholder="Get the guide"
              maxLength={DM_BUTTON_TITLE_MAX}
              aria-invalid={!!errors.dmButtonTitle}
              aria-describedby={errors.dmButtonTitle ? f("btn-title-error") : undefined}
              {...register("dmButtonTitle")}
            />
            <FieldError id={f("btn-title-error")} errors={errMsg(errors.dmButtonTitle?.message)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={f("btn-url")}>Button URL</Label>
            <Input
              id={f("btn-url")}
              type="url"
              inputMode="url"
              placeholder="https://example.com/guide"
              aria-invalid={!!errors.dmButtonUrl}
              aria-describedby={errors.dmButtonUrl ? f("btn-url-error") : undefined}
              {...register("dmButtonUrl")}
            />
            <FieldError id={f("btn-url-error")} errors={errMsg(errors.dmButtonUrl?.message)} />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Controller
          control={control}
          name="oncePerUser"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="grid gap-0.5">
                <Label htmlFor={f("once")}>Once per user</Label>
                <p id={f("once-help")} className="text-muted-foreground text-xs">
                  Don&apos;t DM the same person twice for this rule.
                </p>
              </div>
              <Switch
                id={f("once")}
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-describedby={f("once-help")}
              />
            </div>
          )}
        />
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="grid gap-0.5">
                <Label htmlFor={f("active")}>Active</Label>
                <p id={f("active-help")} className="text-muted-foreground text-xs">
                  Inactive rules are ignored.
                </p>
              </div>
              <Switch
                id={f("active")}
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-describedby={f("active-help")}
              />
            </div>
          )}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {ruleId ? "Save rule" : "Add rule"}
        </Button>
      </div>
    </form>
  );
}
