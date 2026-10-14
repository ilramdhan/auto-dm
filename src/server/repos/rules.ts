import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { rules, type Rule } from "@/server/db/schema";
import type { RuleData } from "@/lib/validation/rule";

export async function listRules(campaignId: string): Promise<Rule[]> {
  return db
    .select()
    .from(rules)
    .where(eq(rules.campaignId, campaignId))
    .orderBy(desc(rules.priority), asc(rules.createdAt));
}

export async function getRule(id: string): Promise<Rule | undefined> {
  const [row] = await db.select().from(rules).where(eq(rules.id, id)).limit(1);
  return row;
}

export async function createRule(campaignId: string, data: RuleData): Promise<Rule> {
  const [row] = await db
    .insert(rules)
    .values({ ...data, campaignId })
    .returning();
  if (!row) throw new Error("Insert failed");
  return row;
}

export async function updateRule(campaignId: string, id: string, data: RuleData): Promise<Rule | undefined> {
  const [row] = await db
    .update(rules)
    .set(data)
    .where(and(eq(rules.id, id), eq(rules.campaignId, campaignId)))
    .returning();
  return row;
}

export async function setRuleActive(campaignId: string, id: string, isActive: boolean): Promise<boolean> {
  const rows = await db
    .update(rules)
    .set({ isActive })
    .where(and(eq(rules.id, id), eq(rules.campaignId, campaignId)))
    .returning({ id: rules.id });
  return rows.length > 0;
}

export async function deleteRule(campaignId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(rules)
    .where(and(eq(rules.id, id), eq(rules.campaignId, campaignId)))
    .returning({ id: rules.id });
  return rows.length > 0;
}
