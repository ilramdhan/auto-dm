"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/components/copy-button";
import { FieldError } from "@/components/field-error";
import {
  announceCommenterDeletion,
  ConfirmDeleteCommenterDialog,
  type CommenterDeletionReceipt,
} from "@/components/data-deletion/delete-commenter";
import type { FieldErrors } from "@/lib/action-result";
import { igUsernameSchema } from "@/lib/validation/data-deletion";
import { deleteCommenterDataAction } from "../activity/actions";

/** Handles a commenter's emailed deletion request when the operator only has their username. */
export function DeleteCommenterCard() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [username, setUsername] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirming, setConfirming] = useState(false);
  const [last, setLast] = useState<(CommenterDeletionReceipt & { handle: string; url: string }) | null>(null);
  const handle = `@${username.trim().replace(/^@/, "")}`;

  function onConfirm() {
    start(async () => {
      const res = await deleteCommenterDataAction({ username });
      if (res.ok && res.data) {
        setErrors({});
        setUsername("");
        setLast({ ...res.data, handle, url: res.data.statusUrl });
        announceCommenterDeletion(handle, res.data);
        router.refresh();
      } else if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = igUsernameSchema.safeParse(username);
          if (!parsed.success) {
            setErrors({ username: parsed.error.issues.map((i) => i.message) });
            return;
          }
          setErrors({});
          setConfirming(true);
        }}
        className="grid grid-cols-1 gap-6"
      >
        <CardHeader>
          <CardTitle>Delete a commenter&apos;s data</CardTitle>
          <CardDescription>
            When someone who commented on your posts emails you to delete their data, enter their Instagram
            username. You can also delete from a row on the Activity page.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="delete-commenter-username">Instagram username</Label>
            <Input
              id="delete-commenter-username"
              placeholder="@username"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? "delete-commenter-username-error" : undefined}
            />
            <FieldError id="delete-commenter-username-error" errors={errors.username} />
          </div>
          {last ? (
            <div className="bg-muted/50 grid gap-2 rounded-md border p-3 text-sm" role="status">
              <p>
                {last.status === "completed"
                  ? `Deleted ${last.deleted} comment record${last.deleted === 1 ? "" : "s"} for ${last.handle}.`
                  : `No data was stored for ${last.handle}.`}{" "}
                Send them this status link:
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-background min-w-0 flex-1 truncate rounded border px-2 py-1 text-xs">
                  {last.url}
                </code>
                <CopyButton value={last.url} label="Copy status link" size="icon-sm" />
              </div>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button type="submit" variant="destructive" disabled={pending || !username.trim()}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
            Delete data
          </Button>
        </CardFooter>
      </form>
      <ConfirmDeleteCommenterDialog
        open={confirming}
        onOpenChange={setConfirming}
        handle={handle}
        onConfirm={onConfirm}
      />
    </Card>
  );
}
