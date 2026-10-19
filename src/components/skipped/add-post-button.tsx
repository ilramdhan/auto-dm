"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { addPostToCampaignAction } from "@/app/(dashboard)/skipped/actions";

/**
 * "Add this post to campaign" for a `no_campaign_for_post` row: after confirming, the comment's post
 * is appended to the campaign's targeted posts. The row stays here so it can still be sent manually.
 */
export function AddPostToCampaignButton({
  deliveryId,
  campaignId,
  campaignName,
}: {
  deliveryId: string;
  campaignId: string;
  campaignName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function onConfirm() {
    startTransition(async () => {
      const res = await addPostToCampaignAction({ campaignId, deliveryId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.added ? `Post added to “${campaignName}”` : `“${campaignName}” already targets this post`,
        {
          description:
            "New comments on this post will be answered automatically. Use “Send manually” for this one.",
        },
      );
      router.refresh();
    });
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
          Add this post to campaign
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Add this post to “{campaignName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The campaign will also answer new comments on this post (for example the ad version of a boosted
            reel), using the same rules. This comment isn&apos;t sent automatically: use &ldquo;Send
            manually&rdquo; afterwards if you want to answer it. You can remove the post again in the
            campaign&apos;s settings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Add post</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
