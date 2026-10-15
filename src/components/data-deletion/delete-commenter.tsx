"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { copyText } from "@/components/copy-button";
import type { DataDeletionStatus } from "@/lib/validation/data-deletion";
import { deleteCommenterDataAction } from "@/app/(dashboard)/activity/actions";

export interface CommenterDeletionReceipt {
  confirmationCode: string;
  status: DataDeletionStatus;
  deleted: number;
  /** Public status page for the confirmation code (from APP_URL), to paste into the reply email. */
  statusUrl: string;
}

/** Toast with the confirmation code and a "Copy link" action for the reply email. */
export function announceCommenterDeletion(handle: string, r: CommenterDeletionReceipt): void {
  const options = {
    description: `Confirmation code: ${r.confirmationCode}`,
    duration: 20_000,
    action: {
      label: "Copy link",
      onClick: () => {
        void copyText(r.statusUrl).then((copied) =>
          copied ? toast.success("Status link copied") : toast.error("Couldn't access the clipboard"),
        );
      },
    },
  };
  if (r.status === "completed") {
    toast.success(`Deleted ${r.deleted} comment record${r.deleted === 1 ? "" : "s"} for ${handle}`, options);
  } else {
    toast.info(`No data stored for ${handle}`, options);
  }
}

/** Confirm dialog shared by the Activity row action and the Settings card. */
export function ConfirmDeleteCommenterDialog({
  open,
  onOpenChange,
  handle,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "@username" (or a fallback label) named in the dialog. */
  handle: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">Delete {handle}&apos;s data?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes all comment records stored for {handle}: their comments and the reply and
            DM history. You&apos;ll get a confirmation code to send back to them. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90 text-white"
            onClick={onConfirm}
          >
            Delete data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Icon button on an Activity row: deletes every stored record of that row's commenter. */
export function DeleteCommenterButton({
  commenterId,
  username,
}: {
  commenterId: string | null;
  username: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const input = commenterId ? { commenterId } : username ? { username } : null;
  if (!input) return null;
  const handle = username ? `@${username}` : "this commenter";
  const label = `Delete ${handle}'s data`;

  function onConfirm() {
    if (!input) return;
    start(async () => {
      const res = await deleteCommenterDataAction(input);
      if (res.ok && res.data) {
        announceCommenterDeletion(handle, res.data);
        router.refresh();
      } else if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        aria-label={label}
        title={label}
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
      </Button>
      <ConfirmDeleteCommenterDialog
        open={open}
        onOpenChange={setOpen}
        handle={handle}
        onConfirm={onConfirm}
      />
    </>
  );
}
