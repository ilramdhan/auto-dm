"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { ExternalLink, Globe, ImageIcon, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FieldError } from "@/components/field-error";
import { MAX_CAMPAIGN_MEDIA, campaignSchema } from "@/lib/validation/campaign";
import { fromDateTimeLocal, toDateTimeLocal, truncate } from "@/lib/format";
import { handleActionResult } from "@/lib/forms";
import { zodFailure } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { createCampaignAction, updateCampaignAction } from "@/app/(dashboard)/campaigns/actions";
import { MediaPickerDialog, type PickedMedia } from "./media-picker";

type FormValues = {
  name: string;
  description: string;
  target: "media" | "all";
  media: PickedMedia[];
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

export type CampaignFormInitial = {
  id: string;
  name: string;
  description: string | null;
  mediaId: string | null;
  mediaIds: string[] | null;
  mediaPermalink: string | null;
  mediaThumbnailUrl: string | null;
  mediaCaption: string | null;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

/**
 * Targeted posts of a saved campaign. Only the first post's preview is stored (`media_*` columns);
 * the others show their id until re-picked in this session.
 */
function initialMedia(c: CampaignFormInitial): PickedMedia[] {
  const ids = c.mediaIds?.length ? c.mediaIds : c.mediaId ? [c.mediaId] : [];
  return ids.map((id, i) =>
    i === 0
      ? { id, permalink: c.mediaPermalink, thumbnailUrl: c.mediaThumbnailUrl, caption: c.mediaCaption }
      : { id, permalink: null, thumbnailUrl: null, caption: null },
  );
}

/** Maps a server/schema error path to the form field that shows it. */
function formField(name: string): keyof FormValues {
  const n = name.replace(/^data\./, "");
  return (/^media(Id|Ids)\b/.test(n) ? "media" : n) as keyof FormValues;
}

export function CampaignForm({ initial }: { initial?: CampaignFormInitial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const form = useForm<FormValues>({
    defaultValues: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      target: initial && initialMedia(initial).length === 0 ? "all" : "media",
      media: initial ? initialMedia(initial) : [],
      isActive: initial?.isActive ?? true,
      // datetime-local values are set after mount (browser timezone), see below.
      startsAt: "",
      endsAt: "",
    },
  });
  const { register, control, handleSubmit, setError, setValue, formState } = form;
  useEffect(() => {
    if (initial?.startsAt) setValue("startsAt", toDateTimeLocal(initial.startsAt));
    if (initial?.endsAt) setValue("endsAt", toDateTimeLocal(initial.endsAt));
  }, [initial?.startsAt, initial?.endsAt, setValue]);
  const errors = formState.errors;
  const target = useWatch({ control, name: "target" });
  const media = useWatch({ control, name: "media" });

  const onSubmit = handleSubmit((v) => {
    const forMedia = v.target === "media";
    // The stored preview (`media_*`) is the first post's; `media_id` mirrors it server-side.
    const first = forMedia ? v.media[0] : undefined;
    const payload = {
      name: v.name,
      description: v.description,
      target: v.target,
      mediaIds: forMedia ? v.media.map((m) => m.id) : [],
      mediaPermalink: first?.permalink ?? null,
      mediaThumbnailUrl: first?.thumbnailUrl ?? null,
      mediaCaption: first?.caption ?? null,
      isActive: v.isActive,
      startsAt: fromDateTimeLocal(v.startsAt),
      endsAt: fromDateTimeLocal(v.endsAt),
    };
    // Same schema the server uses, for instant feedback.
    const local = campaignSchema.safeParse(payload);
    if (!local.success) {
      handleActionResult(zodFailure(local.error), (name, err) => setError(formField(String(name)), err));
      return;
    }
    startTransition(async () => {
      const res = initial
        ? await updateCampaignAction({ id: initial.id, data: payload })
        : await createCampaignAction(payload);
      const okRes = handleActionResult(res, (name, err) => setError(formField(String(name)), err));
      if (!okRes) return;
      if (initial) {
        toast.success("Campaign saved");
        router.refresh();
      } else {
        toast.success("Campaign created", { description: "Now add a rule with the keywords to react to." });
        router.push(`/campaigns/${res.data.id}?new=1`);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="e.g. Free guide giveaway"
          maxLength={100}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          {...register("name")}
        />
        <FieldError id="name-error" errors={errors.name?.message ? [errors.name.message] : undefined} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="description"
          rows={2}
          maxLength={500}
          placeholder="Internal note — only you see this"
          aria-invalid={!!errors.description}
          {...register("description")}
        />
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-3 text-sm font-medium">Which content should trigger this campaign?</legend>
        <Controller
          control={control}
          name="target"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="grid gap-3 sm:grid-cols-2"
            >
              {(
                [
                  {
                    value: "media",
                    title: "Specific posts or reels",
                    desc: "Only comments on the content you pick (one or more).",
                    icon: ImageIcon,
                  },
                  {
                    value: "all",
                    title: "All posts & reels",
                    desc: "Any comment on your account (fallback).",
                    icon: Globe,
                  },
                ] as const
              ).map((o) => (
                <Label
                  key={o.value}
                  htmlFor={`target-${o.value}`}
                  className={cn(
                    "hover:bg-accent/50 flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal transition-colors",
                    field.value === o.value && "border-primary bg-primary/5",
                  )}
                >
                  <RadioGroupItem id={`target-${o.value}`} value={o.value} className="mt-0.5" />
                  <span className="grid gap-1">
                    <span className="flex items-center gap-2 font-medium">
                      <o.icon className="size-4" aria-hidden /> {o.title}
                    </span>
                    <span className="text-muted-foreground text-sm">{o.desc}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          )}
        />
        {target === "media" ? (
          <div className="grid gap-2">
            {media.length > 0 ? (
              <ul className="grid gap-2" aria-label={`Selected posts (${media.length})`}>
                {media.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-lg border p-3">
                    {m.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Instagram CDN URLs, not optimizable
                      <img src={m.thumbnailUrl} alt="" className="size-14 shrink-0 rounded-md object-cover" />
                    ) : (
                      <span className="bg-muted flex size-14 shrink-0 items-center justify-center rounded-md">
                        <ImageIcon className="text-muted-foreground size-5" aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm break-words">
                        {m.caption ? (
                          truncate(m.caption, 140)
                        ) : m.thumbnailUrl || m.permalink ? (
                          "No caption"
                        ) : (
                          <span className="font-mono text-xs break-all">Post {m.id}</span>
                        )}
                      </p>
                      <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                        {i === 0 && media.length > 1 ? <span>Main post (shown in lists)</span> : null}
                        {m.permalink ? (
                          <a
                            href={m.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            View on Instagram <ExternalLink className="size-3" aria-hidden />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        ) : null}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${m.caption ? `“${truncate(m.caption, 40)}”` : `post ${m.id}`}`}
                      onClick={() =>
                        setValue(
                          "media",
                          media.filter((x) => x.id !== m.id),
                          { shouldDirty: true },
                        )
                      }
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className={cn(
                media.length === 0 && "h-auto justify-start gap-3 border-dashed py-4",
                media.length > 0 && "justify-self-start",
                errors.media && "border-destructive",
              )}
              onClick={() => setPickerOpen(true)}
              aria-describedby={`media-help${errors.media ? " media-error" : ""}`}
            >
              {media.length === 0 ? <ImageIcon aria-hidden /> : <Plus aria-hidden />}
              {media.length === 0 ? "Choose posts or reels…" : "Add or change posts…"}
            </Button>
            <p id="media-help" className="text-muted-foreground text-xs">
              {media.length} of {MAX_CAMPAIGN_MEDIA} posts. Boosted a reel? Add its ad version too, or use
              &ldquo;Add this post to campaign&rdquo; on the Skipped comments page.
            </p>
            <FieldError
              id="media-error"
              errors={errors.media?.message ? [errors.media.message] : undefined}
            />
            <Controller
              control={control}
              name="media"
              render={({ field }) => (
                <MediaPickerDialog
                  open={pickerOpen}
                  onOpenChange={setPickerOpen}
                  selected={field.value}
                  max={MAX_CAMPAIGN_MEDIA}
                  onSelect={(m) => {
                    field.onChange(m);
                    form.clearErrors("media");
                  }}
                />
              )}
            />
          </div>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">
          Schedule <span className="text-muted-foreground font-normal">(optional)</span>
        </legend>
        <p id="schedule-help" className="text-muted-foreground text-sm">
          Leave empty to run indefinitely. Times are in your browser&apos;s time zone.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="startsAt">Starts</Label>
            <Input
              id="startsAt"
              type="datetime-local"
              aria-describedby="schedule-help"
              {...register("startsAt")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="endsAt">Ends</Label>
            <Input
              id="endsAt"
              type="datetime-local"
              aria-invalid={!!errors.endsAt}
              aria-describedby={`schedule-help${errors.endsAt ? " endsAt-error" : ""}`}
              {...register("endsAt")}
            />
            <FieldError
              id="endsAt-error"
              errors={errors.endsAt?.message ? [errors.endsAt.message] : undefined}
            />
          </div>
        </div>
      </fieldset>

      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="grid gap-1">
              <Label htmlFor="isActive">Active</Label>
              <p id="isActive-help" className="text-muted-foreground text-sm">
                Paused campaigns ignore new comments.
              </p>
            </div>
            <Switch
              id="isActive"
              checked={field.value}
              onCheckedChange={field.onChange}
              aria-describedby="isActive-help"
            />
          </div>
        )}
      />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {!initial ? (
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {initial ? "Save changes" : "Create campaign"}
        </Button>
      </div>
    </form>
  );
}
