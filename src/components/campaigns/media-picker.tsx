"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Clapperboard, Images, ImageOff, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { InstagramIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { truncate } from "@/lib/format";
import { listMediaAction } from "@/app/(dashboard)/campaigns/actions";
import type { MediaItem } from "@/server/instagram/account";

export type PickedMedia = {
  id: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
};

function kind(m: MediaItem): { label: string; icon: typeof Images } {
  if (m.mediaProductType === "REELS") return { label: "Reel", icon: Clapperboard };
  if (m.mediaType === "CAROUSEL_ALBUM") return { label: "Carousel", icon: Images };
  if (m.mediaType === "VIDEO") return { label: "Video", icon: Clapperboard };
  return { label: "Post", icon: Images };
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId?: string | null;
  onSelect: (m: PickedMedia) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loaded" | "not-connected" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<string | null>(selectedId ?? null);

  const load = useCallback((after: string | null) => {
    startTransition(async () => {
      const res = await listMediaAction({ after });
      if (!res.ok) {
        setState("error");
        setError(res.error);
        return;
      }
      if (!res.data.connected) {
        setState("not-connected");
        return;
      }
      const page = res.data;
      setItems((prev) => (after ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
      setState("loaded");
    });
  }, []);

  useEffect(() => {
    if (open && state === "idle") load(null);
  }, [open, state, load]);

  const picked = items.find((i) => i.id === choice);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a post or reel</DialogTitle>
          <DialogDescription>
            Comments on the selected content will trigger this campaign&apos;s rules.
          </DialogDescription>
        </DialogHeader>

        {state === "not-connected" ? (
          <Alert variant="info">
            <InstagramIcon />
            <AlertTitle>Instagram isn&apos;t connected yet</AlertTitle>
            <AlertDescription>
              <p>
                Connect your account to browse your posts, or target &ldquo;All posts &amp; reels&rdquo; for
                now.
              </p>
              <Button asChild size="sm" className="mt-2">
                <Link href="/settings?tab=instagram">Connect Instagram</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : state === "error" ? (
          <Alert variant="destructive">
            <ImageOff />
            <AlertTitle>Couldn&apos;t load posts</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => load(null)}>
                <RefreshCw aria-hidden /> Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="max-h-[60dvh] overflow-y-auto pr-1">
            {items.length === 0 && pending ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-md" />
                ))}
              </div>
            ) : items.length === 0 && state === "loaded" ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No posts found on this account yet.
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-label="Posts and reels"
                className="grid grid-cols-3 gap-2 sm:grid-cols-4"
              >
                {items.map((m) => {
                  const k = kind(m);
                  const Icon = k.icon;
                  const selected = choice === m.id;
                  const date = m.timestamp
                    ? new Date(m.timestamp).toLocaleDateString("en", { dateStyle: "medium" })
                    : "";
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${k.label}${date ? ` from ${date}` : ""}: ${m.caption ? truncate(m.caption, 80) : "no caption"}`}
                      onClick={() => setChoice(m.id)}
                      onDoubleClick={() => {
                        onSelect({
                          id: m.id,
                          permalink: m.permalink,
                          thumbnailUrl: m.thumbnailUrl,
                          caption: m.caption,
                        });
                        onOpenChange(false);
                      }}
                      className={cn(
                        "group bg-muted focus-visible:ring-ring relative aspect-square overflow-hidden rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2",
                        selected && "ring-primary ring-[3px] ring-offset-2",
                      )}
                    >
                      {m.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Instagram CDN URLs, not optimizable
                        <img
                          src={m.thumbnailUrl}
                          alt=""
                          className="size-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-muted-foreground flex size-full items-center justify-center">
                          <ImageOff className="size-6" aria-hidden />
                        </span>
                      )}
                      <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        <Icon className="size-3" aria-hidden />
                        {k.label}
                      </span>
                      {selected ? (
                        <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full">
                          <Check className="size-4" aria-hidden />
                        </span>
                      ) : null}
                      {m.caption ? (
                        <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-4 pb-1 text-[11px] text-white">
                          {m.caption}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
            {cursor ? (
              <div className="mt-3 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => load(cursor)}
                  disabled={pending}
                >
                  {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  Load more
                </Button>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!picked}
            onClick={() => {
              if (!picked) return;
              onSelect({
                id: picked.id,
                permalink: picked.permalink,
                thumbnailUrl: picked.thumbnailUrl,
                caption: picked.caption,
              });
              onOpenChange(false);
            }}
          >
            Use this post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
