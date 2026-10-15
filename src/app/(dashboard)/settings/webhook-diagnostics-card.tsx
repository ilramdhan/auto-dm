"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, timeAgo } from "@/lib/format";
import {
  matchLabel,
  WEBHOOK_RESULT_META,
  webhookVerdict,
  type SubscriptionStatus,
  type WebhookRequestKind,
  type WebhookRequestResult,
  type WebhookRequestSource,
  type WebhookVerdict,
} from "@/lib/webhook-diagnostics";
import { resubscribeWebhooksAction } from "./actions";

export type WebhookRequestView = {
  id: string;
  kind: WebhookRequestKind;
  source: WebhookRequestSource;
  result: WebhookRequestResult;
  statusCode: number;
  entries: number | null;
  commentEvents: number | null;
  matchedEntries: number | null;
  createdAt: Date;
};

const VERDICTS: Record<
  WebhookVerdict,
  { title: string; tone: "success" | "warning" | "info"; body: string }
> = {
  never_received: {
    title: "Meta hasn't called this app yet",
    tone: "warning",
    body: "No webhook request has reached this app. If comments show nothing in Activity, Meta isn't sending them: work through the checklist below.",
  },
  verified_only: {
    title: "Verified, but no comments received yet",
    tone: "warning",
    body: "Meta verified the callback URL, but hasn't delivered a comment. Check the comments subscription, App mode and Instagram Testers below.",
  },
  rejected: {
    title: "Meta is calling, but the last request was rejected",
    tone: "warning",
    body: "See the reason in the table. “Signature invalid” almost always means the App Secret saved here isn't the Instagram App Secret of the app sending webhooks.",
  },
  other_account: {
    title: "Webhooks arrive, but not for the connected account",
    tone: "warning",
    body: "Accepted requests were addressed to a different Instagram account id. The dashboard's “Test” button sends a sample like this; for real comments, reconnect the account the post belongs to.",
  },
  ok: {
    title: "Webhooks are arriving",
    tone: "success",
    body: "Meta delivers comments for your account. If a specific comment did nothing, open Activity: each row explains why it was skipped.",
  },
};

function ResultBadge({ result }: { result: WebhookRequestResult }) {
  const meta = WEBHOOK_RESULT_META[result];
  const Icon = meta.tone === "success" ? CheckCircle2 : meta.tone === "danger" ? XCircle : AlertTriangle;
  return (
    <Badge variant={meta.tone} title={meta.help}>
      <Icon aria-hidden /> {meta.label}
    </Badge>
  );
}

export function WebhookDiagnosticsCard({
  requests,
  subscription,
  accountConnected,
  webhookUrl,
  mode,
}: {
  requests: WebhookRequestView[];
  subscription: SubscriptionStatus | null;
  accountConnected: boolean;
  webhookUrl: string;
  mode: "webhook" | "n8n";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const verdict = webhookVerdict(requests);
  const v = VERDICTS[verdict];
  const deliveries = requests.filter((r) => r.kind === "delivery");
  const lastVerify = requests.find((r) => r.kind === "verification");
  const latestRejected = deliveries[0] && deliveries[0].result !== "accepted" ? deliveries[0] : null;

  function resubscribe() {
    start(async () => {
      const res = await resubscribeWebhooksAction({});
      if (res.ok) {
        const fields = res.data.fields;
        toast.success("Webhooks subscribed", {
          description: fields?.length ? `Subscribed fields: ${fields.join(", ")}` : undefined,
        });
      } else toast.error("Couldn't subscribe webhooks", { description: res.error });
      router.refresh();
    });
  }

  return (
    <Card id="webhook-diagnostics" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Webhook diagnostics</CardTitle>
        <CardDescription>
          The last requests Meta sent to this app, to find out why a test comment did nothing.
        </CardDescription>
        <CardAction>
          {verdict === "ok" ? (
            <Badge variant="success">
              <CheckCircle2 aria-hidden /> Receiving
            </Badge>
          ) : verdict === "never_received" ? (
            <Badge variant="muted">
              <CircleDashed aria-hidden /> Nothing received
            </Badge>
          ) : (
            <Badge variant="warning">
              <AlertTriangle aria-hidden /> Needs attention
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-6">
        <Alert variant={v.tone}>
          {v.tone === "success" ? <CheckCircle2 aria-hidden /> : <AlertTriangle aria-hidden />}
          <AlertTitle>{v.title}</AlertTitle>
          <AlertDescription>
            <p>{v.body}</p>
            {latestRejected ? <p>{WEBHOOK_RESULT_META[latestRejected.result].help}</p> : null}
          </AlertDescription>
        </Alert>

        <section aria-labelledby="webhook-subscription-heading" className="grid gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="grid gap-1">
              <h3 id="webhook-subscription-heading" className="text-sm font-medium">
                Account subscription
              </h3>
              <p className="text-muted-foreground text-sm">
                {subscription ? (
                  <>
                    {subscription.ok ? (
                      <Badge variant="success" className="mr-2">
                        <CheckCircle2 aria-hidden /> Subscribed
                      </Badge>
                    ) : (
                      <Badge variant="danger" className="mr-2">
                        <XCircle aria-hidden /> Failed
                      </Badge>
                    )}
                    {subscription.source === "connect" ? "On connect" : "Re-subscribed"},{" "}
                    <time dateTime={subscription.at} title={formatDateTime(subscription.at)}>
                      {timeAgo(subscription.at)}
                    </time>
                    {subscription.fields?.length ? <> · fields: {subscription.fields.join(", ")}</> : null}
                  </>
                ) : (
                  "Not recorded yet. Connected before this version? Re-subscribe once to check."
                )}
              </p>
              {subscription && !subscription.ok && subscription.error ? (
                <p className="text-destructive text-xs break-words">{subscription.error}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={pending || !accountConnected}
              onClick={resubscribe}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
              Re-subscribe webhooks
            </Button>
          </div>
          {!accountConnected ? (
            <p className="text-muted-foreground text-xs">Connect an Instagram account to subscribe it.</p>
          ) : null}
        </section>

        <section aria-labelledby="webhook-deliveries-heading" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="webhook-deliveries-heading" className="text-sm font-medium">
              Recent webhook deliveries
            </h3>
            <p className="text-muted-foreground text-xs">
              Last verification:{" "}
              {lastVerify ? (
                <>
                  {WEBHOOK_RESULT_META[lastVerify.result].label.toLowerCase()},{" "}
                  <time
                    dateTime={lastVerify.createdAt.toISOString()}
                    title={formatDateTime(lastVerify.createdAt)}
                  >
                    {timeAgo(lastVerify.createdAt)}
                  </time>
                </>
              ) : (
                "none recorded"
              )}
            </p>
          </div>
          {deliveries.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
              No webhook deliveries recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <caption className="sr-only">Recent webhook deliveries, newest first</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-3">Time</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Via</TableHead>
                    <TableHead className="text-right">Comments</TableHead>
                    <TableHead className="pr-3">Account</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.slice(0, 20).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-3">
                        <time
                          dateTime={r.createdAt.toISOString()}
                          title={formatDateTime(r.createdAt)}
                          className="text-muted-foreground text-xs whitespace-nowrap"
                        >
                          {timeAgo(r.createdAt)}
                        </time>
                      </TableCell>
                      <TableCell>
                        <ResultBadge result={r.result} />
                        <span className="sr-only">. {WEBHOOK_RESULT_META[r.result].help}</span>
                      </TableCell>
                      <TableCell className="text-xs">{r.source === "n8n" ? "n8n" : "Direct"}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {r.commentEvents ?? "—"}
                      </TableCell>
                      <TableCell className="pr-3 text-xs">{matchLabel(r)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-muted-foreground text-xs">
            Only the outcome and counts are kept (the last 50), never comment text or signatures.
          </p>
        </section>

        <section aria-labelledby="webhook-checklist-heading" className="grid gap-2">
          <h3 id="webhook-checklist-heading" className="text-sm font-medium">
            Nothing arrives? Check, in order
          </h3>
          <ol className="text-muted-foreground grid list-decimal gap-1.5 pl-5 text-sm marker:font-medium">
            <li>
              {mode === "n8n" ? (
                <>Meta&apos;s callback URL points at your n8n webhook, and n8n forwards to this app.</>
              ) : (
                <>
                  Meta&apos;s callback URL is exactly{" "}
                  <code className="text-foreground break-all">{webhookUrl}</code>.
                </>
              )}
            </li>
            <li>
              “Verify and save” succeeded (Last verification above says <em>verified</em>).
            </li>
            <li>
              The <code className="text-foreground">comments</code> field is subscribed in Meta, and the
              account subscription above says <em>Subscribed</em>.
            </li>
            <li>
              You tested from a <strong>second account</strong>: comments by the connected account itself are
              never answered.
            </li>
            <li>
              In <strong>Development</strong> mode, that second account must be added under App roles →
              Instagram Testers <strong>and</strong> have accepted the invite in Instagram (Settings → Apps
              and websites → Tester invites).
            </li>
            <li>
              Comments from everyone else need the app in <strong>Live</strong> mode with Advanced Access for
              the comments permission.
            </li>
            <li>The connected account is public and a Business or Creator account.</li>
          </ol>
        </section>
      </CardContent>
    </Card>
  );
}
