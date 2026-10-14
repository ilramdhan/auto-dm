"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Link2,
  MessageSquareReply,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import { EmptyState } from "@/components/empty-state";
import { MATCH_MODE_INFO, type MatchMode } from "@/lib/validation/rule";
import { truncate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteRuleAction, setRuleActiveAction } from "@/app/(dashboard)/campaigns/[id]/actions";
import { EMPTY_RULE, RuleForm, type RuleFormValues } from "./rule-form";

export type RuleView = {
  id: string;
  name: string;
  keywords: string[];
  matchMode: MatchMode;
  publicReplies: string[];
  dmMessage: string;
  dmButtonTitle: string | null;
  dmButtonUrl: string | null;
  oncePerUser: boolean;
  priority: number;
  isActive: boolean;
};

function toFormValues(r: RuleView): RuleFormValues {
  return {
    name: r.name,
    keywords: r.keywords,
    matchMode: r.matchMode,
    publicReplies: r.publicReplies.map((text) => ({ text })),
    dmMessage: r.dmMessage,
    dmButtonTitle: r.dmButtonTitle ?? "",
    dmButtonUrl: r.dmButtonUrl ?? "",
    oncePerUser: r.oncePerUser,
    priority: r.priority,
    isActive: r.isActive,
  };
}

export function RulesEditor({
  campaignId,
  rules,
  startWithNew,
}: {
  campaignId: string;
  rules: RuleView[];
  startWithNew?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(startWithNew && rules.length === 0 ? "new" : null);

  const done = () => {
    setEditing(null);
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Rules</h2>
          <p className="text-muted-foreground text-sm">
            Keywords → public reply + DM. The highest-priority matching rule wins.
          </p>
        </div>
        {editing !== "new" ? (
          <Button onClick={() => setEditing("new")} size="sm">
            <Plus aria-hidden /> Add rule
          </Button>
        ) : null}
      </div>

      {editing === "new" ? (
        <Card className="border-primary/40">
          <CardContent>
            <h3 className="mb-4 font-semibold">New rule</h3>
            <RuleForm
              campaignId={campaignId}
              defaultValues={{ ...EMPTY_RULE, name: rules.length ? `Rule ${rules.length + 1}` : "Main rule" }}
              onSaved={done}
              onCancel={() => setEditing(null)}
            />
          </CardContent>
        </Card>
      ) : null}

      {rules.length === 0 && editing !== "new" ? (
        <EmptyState
          icon={Zap}
          title="No rules yet"
          description="Add a rule with the keywords people will comment (e.g. “guide”, “link”) and the DM they should receive."
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus aria-hidden /> Add your first rule
            </Button>
          }
        />
      ) : null}

      <ul className="grid gap-3">
        {rules.map((r) => (
          <li key={r.id}>
            {editing === r.id ? (
              <Card className="border-primary/40">
                <CardContent>
                  <h3 className="mb-4 font-semibold">Edit “{r.name}”</h3>
                  <RuleForm
                    campaignId={campaignId}
                    ruleId={r.id}
                    defaultValues={toFormValues(r)}
                    onSaved={done}
                    onCancel={() => setEditing(null)}
                  />
                </CardContent>
              </Card>
            ) : (
              <RuleSummary campaignId={campaignId} rule={r} onEdit={() => setEditing(r.id)} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RuleSummary({
  campaignId,
  rule,
  onEdit,
}: {
  campaignId: string;
  rule: RuleView;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useOptimistic(rule.isActive);
  const [expanded, setExpanded] = useState(false);
  const switchId = `rule-active-${rule.id}`;

  function toggle(next: boolean) {
    startTransition(async () => {
      setActive(next);
      const res = await setRuleActiveAction({ campaignId, ruleId: rule.id, isActive: next });
      if (res.ok) {
        toast.success(next ? `Rule “${rule.name}” enabled` : `Rule “${rule.name}” disabled`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteRuleAction({ campaignId, ruleId: rule.id });
      if (res.ok) {
        toast.success(`Rule “${rule.name}” deleted`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card className={cn("gap-0 py-0 transition-opacity", !active && "opacity-75")}>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{rule.name}</h3>
              {!active ? <Badge variant="muted">Disabled</Badge> : null}
              <Badge variant="outline" title="Match mode">
                {MATCH_MODE_INFO[rule.matchMode].label}
              </Badge>
              {rule.priority !== 0 ? <Badge variant="outline">Priority {rule.priority}</Badge> : null}
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Keywords">
              {rule.keywords.map((k) => (
                <li key={k} className="bg-secondary rounded-md px-2 py-0.5 text-sm">
                  {k}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Switch
              id={switchId}
              checked={active}
              onCheckedChange={toggle}
              disabled={pending}
              aria-label={`Enable rule ${rule.name}`}
            />
          </div>
        </div>

        <div className="text-muted-foreground grid gap-1.5 text-sm">
          <p className="flex gap-2">
            <Send className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="sr-only">DM: </span>
            <span className={cn("text-foreground whitespace-pre-line", !expanded && "line-clamp-2")}>
              {rule.dmMessage}
            </span>
          </p>
          <p className="flex gap-2">
            <MessageSquareReply className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {rule.publicReplies.length === 0
                ? "No public reply"
                : `${rule.publicReplies.length} public reply ${rule.publicReplies.length === 1 ? "variant" : "variants"}: “${truncate(rule.publicReplies[0] ?? "", 60)}”`}
            </span>
          </p>
          {rule.dmButtonTitle && rule.dmButtonUrl ? (
            <p className="flex gap-2">
              <Link2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Button “{rule.dmButtonTitle}” → <span className="break-all">{rule.dmButtonUrl}</span>
              </span>
            </p>
          ) : null}
          {rule.oncePerUser ? (
            <p className="flex gap-2">
              <UserCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Once per user</span>
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2">
        {rule.dmMessage.length > 120 ? (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
            <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} aria-hidden />
            {expanded ? "Less" : "Full message"}
          </Button>
        ) : null}
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil aria-hidden /> Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={pending}
              >
                <Trash2 aria-hidden /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete rule “{rule.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  Comments with these keywords will no longer get a reply or DM. Past activity stays in the
                  log.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90 text-white"
                  onClick={remove}
                >
                  Delete rule
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
}
