"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ok } from "@/lib/action-result";
import { ruleSchema, testCommentSchema } from "@/lib/validation/rule";
import { authedAction } from "@/server/actions/safe-action";
import { matchComment } from "@/server/engine/match";
import { renderTemplate } from "@/server/engine/template";
import { AppError } from "@/server/errors";
import { logger } from "@/server/log";
import { getCampaign } from "@/server/repos/campaigns";
import { createRule, deleteRule, listRules, setRuleActive, updateRule } from "@/server/repos/rules";

const log = logger("rules");

function revalidate(campaignId: string) {
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
}

export const saveRuleAction = authedAction(
  "rules",
  "save",
  z.object({ campaignId: z.uuid(), ruleId: z.uuid().optional(), data: ruleSchema }),
  async ({ campaignId, ruleId, data }) => {
    if (!(await getCampaign(campaignId))) throw new AppError("NOT_FOUND", "This campaign no longer exists.");
    if (ruleId) {
      const row = await updateRule(campaignId, ruleId, data);
      if (!row) throw new AppError("NOT_FOUND", "This rule no longer exists.");
    } else {
      const row = await createRule(campaignId, data);
      ruleId = row.id;
      log.info("rule.created", { campaignId, ruleId });
    }
    revalidate(campaignId);
    return ok({ id: ruleId });
  },
);

export const setRuleActiveAction = authedAction(
  "rules",
  "set_active",
  z.object({ campaignId: z.uuid(), ruleId: z.uuid(), isActive: z.boolean() }),
  async ({ campaignId, ruleId, isActive }) => {
    if (!(await setRuleActive(campaignId, ruleId, isActive)))
      throw new AppError("NOT_FOUND", "This rule no longer exists.");
    revalidate(campaignId);
    return ok({ isActive });
  },
);

export const deleteRuleAction = authedAction(
  "rules",
  "delete",
  z.object({ campaignId: z.uuid(), ruleId: z.uuid() }),
  async ({ campaignId, ruleId }) => {
    if (!(await deleteRule(campaignId, ruleId)))
      throw new AppError("NOT_FOUND", "This rule no longer exists.");
    log.info("rule.deleted", { campaignId, ruleId });
    revalidate(campaignId);
    return ok();
  },
);

export type TestCommentResult =
  | { matched: false; activeRuleCount: number }
  | {
      matched: true;
      ruleId: string;
      ruleName: string;
      keyword: string;
      publicReplies: string[];
      dm: string;
      button: { title: string; url: string } | null;
      oncePerUser: boolean;
    };

/** Dry run of the matcher + templates against this campaign's saved rules. Sends nothing. */
export const testCommentAction = authedAction(
  "rules",
  "test_comment",
  testCommentSchema.extend({ campaignId: z.uuid() }),
  async ({ campaignId, text, username }) => {
    const rules = await listRules(campaignId);
    const match = matchComment(text, rules);
    if (!match)
      return ok<TestCommentResult>({
        matched: false,
        activeRuleCount: rules.filter((r) => r.isActive).length,
      });
    const vars = { username: username || "commenter", keyword: match.keyword };
    const { rule } = match;
    return ok<TestCommentResult>({
      matched: true,
      ruleId: rule.id,
      ruleName: rule.name,
      keyword: match.keyword,
      publicReplies: rule.publicReplies.map((r) => renderTemplate(r, vars)),
      dm: renderTemplate(rule.dmMessage, vars),
      button:
        rule.dmButtonTitle && rule.dmButtonUrl ? { title: rule.dmButtonTitle, url: rule.dmButtonUrl } : null,
      oncePerUser: rule.oncePerUser,
    });
  },
);
