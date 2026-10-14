"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, KeyRound, Loader2, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { CopyButton } from "@/components/copy-button";
import { FieldError } from "@/components/field-error";
import { timeAgo } from "@/lib/format";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";

type Key = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export function N8nTab({ keys, appUrl, mode }: { keys: Key[]; appUrl: string; mode: "webhook" | "n8n" }) {
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      {mode !== "n8n" ? (
        <Alert variant="info">
          <AlertTitle>n8n is optional</AlertTitle>
          <AlertDescription>
            Processing mode is currently “Direct webhook”. Switch it to n8n in the Processing tab once your
            workflow is running.
          </AlertDescription>
        </Alert>
      ) : null}
      <WorkflowCard appUrl={appUrl} />
      <ApiKeysCard keys={keys} />
    </div>
  );
}

function WorkflowCard({ appUrl }: { appUrl: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Relay workflow</CardTitle>
        <CardDescription>
          A ready-made n8n workflow that forwards Instagram webhooks to this app.
        </CardDescription>
        <CardAction>
          <Button asChild size="sm">
            <a href="/settings/n8n-workflow" download>
              <Download aria-hidden /> Download
            </a>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ol className="text-muted-foreground grid list-decimal gap-1.5 pl-5 text-sm marker:font-medium">
          <li>Create an API key below and copy it.</li>
          <li>
            In n8n: Workflows → Import from file → choose the downloaded JSON (pre-filled with {appUrl}).
          </li>
          <li>
            Create a “Header Auth” credential: name <code className="text-foreground">Authorization</code>,
            value <code className="text-foreground">Bearer &lt;your key&gt;</code>.
          </li>
          <li>Activate the workflow and use its production webhook URL as the callback URL in Meta.</li>
          <li>Set Processing mode to “Through n8n”.</li>
        </ol>
      </CardContent>
    </Card>
  );
}

function ApiKeysCard({ keys }: { keys: Key[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("n8n");
  const [error, setError] = useState<string[] | undefined>();
  const [created, setCreated] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset(o: boolean) {
    setOpen(o);
    if (!o) {
      setCreated(null);
      setName("n8n");
      setError(undefined);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardDescription>Used by n8n to call this app. Only a hash is stored.</CardDescription>
        <CardAction>
          <Dialog open={open} onOpenChange={reset}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus aria-hidden /> New key
              </Button>
            </DialogTrigger>
            <DialogContent>
              {created ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Copy your new API key</DialogTitle>
                    <DialogDescription>
                      This is the only time it&apos;s shown. Store it in your n8n credential now.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={created}
                      className="font-mono text-xs"
                      aria-label="New API key"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <CopyButton value={created} label="Copy API key" />
                  </div>
                  <Alert variant="warning">
                    <TriangleAlert aria-hidden />
                    <AlertDescription>If you lose it, revoke it and create a new one.</AlertDescription>
                  </Alert>
                  <DialogFooter>
                    <Button onClick={() => reset(false)}>Done</Button>
                  </DialogFooter>
                </>
              ) : (
                <form
                  noValidate
                  className="grid gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    start(async () => {
                      const res = await createApiKeyAction({ name });
                      if (res.ok) {
                        setCreated(res.data.key);
                        router.refresh();
                      } else {
                        setError(res.fieldErrors?.name ?? [res.error]);
                      }
                    });
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>Create API key</DialogTitle>
                    <DialogDescription>
                      Give it a name you&apos;ll recognise, e.g. the n8n instance.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-2">
                    <Label htmlFor="api-key-name">Name</Label>
                    <Input
                      id="api-key-name"
                      value={name}
                      maxLength={60}
                      onChange={(e) => setName(e.target.value)}
                      aria-invalid={!!error}
                      aria-describedby={error ? "api-key-name-error" : undefined}
                      autoFocus
                    />
                    <FieldError id="api-key-name-error" errors={error} />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => reset(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={pending}>
                      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                      Create key
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </CardAction>
      </CardHeader>
      <CardContent>
        {keys.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm">
            <KeyRound className="size-5" aria-hidden />
            No API keys yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead className="hidden sm:table-cell">Last used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="max-w-40 truncate font-medium">{k.name}</TableCell>
                  <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                  <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">
                    {k.lastUsedAt ? timeAgo(k.lastUsedAt) : "Never"}
                  </TableCell>
                  <TableCell>
                    {k.revokedAt ? (
                      <Badge variant="muted">Revoked</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!k.revokedAt ? <RevokeButton id={k.id} name={k.name} /> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RevokeButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={pending}
        >
          Revoke
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Any n8n workflow using this key stops working immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90 text-white"
            onClick={() =>
              start(async () => {
                const res = await revokeApiKeyAction({ id });
                if (res.ok) {
                  toast.success(`Key “${name}” revoked`);
                  router.refresh();
                } else toast.error(res.error);
              })
            }
          >
            Revoke key
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
