"use client";

import { useState, useTransition } from "react";
import { CircleCheck, CircleX, FlaskConical, Link2, Loader2, MessageSquareReply, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/field-error";
import { testCommentAction, type TestCommentResult } from "@/app/(dashboard)/campaigns/[id]/actions";

export function TestCommentBox({ campaignId }: { campaignId: string }) {
  const [text, setText] = useState("");
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<TestCommentResult | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function run(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await testCommentAction({ campaignId, text, username });
      if (res.ok) {
        setResult(res.data);
        setError(undefined);
      } else {
        setResult(null);
        setError(res.fieldErrors?.text?.[0] ?? res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="text-primary size-4" aria-hidden /> Test a comment
        </CardTitle>
        <CardDescription>Dry run against the saved rules. Nothing is sent.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={run} className="grid gap-3" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="test-text">Comment</Label>
            <Textarea
              id="test-text"
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Can I get the GUIDE please? 🙏"
              aria-invalid={!!error}
              aria-describedby={error ? "test-text-error" : undefined}
            />
            <FieldError id="test-text-error" errors={error ? [error] : undefined} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="test-username">
              Commenter username <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="test-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="jane.doe"
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Run test
          </Button>
        </form>

        <div aria-live="polite">
          {result ? (
            result.matched ? (
              <div className="border-success/40 bg-success/5 grid gap-3 rounded-lg border p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <CircleCheck className="text-success size-4" aria-hidden />
                  Matched rule “{result.ruleName}”<Badge variant="outline">keyword: {result.keyword}</Badge>
                </p>
                {result.publicReplies.length ? (
                  <div className="grid gap-1">
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                      <MessageSquareReply className="size-3.5" aria-hidden /> Public reply (one at random)
                    </p>
                    <ul className="grid gap-1">
                      {result.publicReplies.map((r, i) => (
                        <li key={i} className="bg-background rounded-md border px-2.5 py-1.5">
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">No public reply configured.</p>
                )}
                <div className="grid gap-1">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                    <Send className="size-3.5" aria-hidden /> Direct message
                  </p>
                  <div className="bg-background rounded-md border px-2.5 py-1.5 whitespace-pre-line">
                    {result.dm}
                  </div>
                  {result.button ? (
                    <p className="bg-background text-primary flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 font-medium">
                      <Link2 className="size-3.5" aria-hidden />
                      {result.button.title}
                    </p>
                  ) : null}
                </div>
                {result.oncePerUser ? (
                  <p className="text-muted-foreground text-xs">Sent only once per commenter for this rule.</p>
                ) : null}
              </div>
            ) : (
              <div className="bg-muted/50 flex gap-2 rounded-lg border p-3 text-sm">
                <CircleX className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-medium">No rule matched</p>
                  <p className="text-muted-foreground text-xs">
                    {result.activeRuleCount === 0
                      ? "This campaign has no active rules yet."
                      : "Check the keywords and match mode. This comment would be logged as skipped."}
                  </p>
                </div>
              </div>
            )
          ) : null}
        </div>
        <p className="text-muted-foreground border-t pt-3 text-xs">
          Testing on Instagram? Comment from a <strong className="text-foreground">second account</strong>:
          comments by the connected account are ignored. While your Meta app is in Development mode, that
          account must be an accepted Instagram Tester.
        </p>
      </CardContent>
    </Card>
  );
}
