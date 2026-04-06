import { db, merchantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PLAN_LIMITS } from "./billing-config.js";

export interface UsageStatus {
  found: boolean;
  allowed: boolean;
  plan: string;
  effectivePlan: string;
  limit: number;
  used: number;
  remaining: number;
  subscriptionStatus: string;
  blockedReason?: "over_limit" | "subscription_inactive";
}

/** Statuses that entitle the merchant to their paid plan's full limits */
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function getBillingPeriodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// Check plan limits; inactive subscriptions are downgraded to free-tier limits.
// Returns found:false for unknown merchants so middleware can pass through.
export async function checkUsage(shopId: string): Promise<UsageStatus> {
  const rows = await db
    .select({
      id: merchantsTable.id,
      plan: merchantsTable.plan,
      subscriptionStatus: merchantsTable.subscriptionStatus,
      monthlyMessageCount: merchantsTable.monthlyMessageCount,
      usagePeriodStart: merchantsTable.usagePeriodStart,
    })
    .from(merchantsTable)
    .where(eq(merchantsTable.shopId, shopId))
    .limit(1);

  if (rows.length === 0) {
    // Merchant not found — let the route handler return the appropriate 403
    return {
      found: false,
      allowed: true,
      plan: "free",
      effectivePlan: "free",
      limit: PLAN_LIMITS["free"]!,
      used: 0,
      remaining: 0,
      subscriptionStatus: "none",
    };
  }

  const merchant = rows[0];
  const plan = merchant.plan ?? "free";
  const status = merchant.subscriptionStatus ?? "none";

  // Paid limits only apply when the subscription is genuinely active
  const effectivePlan = ACTIVE_STATUSES.has(status) ? plan : "free";
  const limit = PLAN_LIMITS[effectivePlan] ?? PLAN_LIMITS["free"]!;

  const periodStart = getBillingPeriodStart();
  const storedPeriodStart = merchant.usagePeriodStart;
  const needsReset = !storedPeriodStart || storedPeriodStart < periodStart;

  if (needsReset) {
    await db
      .update(merchantsTable)
      .set({
        monthlyMessageCount: 0,
        usagePeriodStart: periodStart,
        updatedAt: new Date(),
      })
      .where(eq(merchantsTable.id, merchant.id));
  }

  const used = needsReset ? 0 : (merchant.monthlyMessageCount ?? 0);
  const remaining = Math.max(0, limit - used);
  const allowed = used < limit;

  return {
    found: true,
    allowed,
    plan,
    effectivePlan,
    limit,
    used,
    remaining,
    subscriptionStatus: status,
    blockedReason: allowed ? undefined : "over_limit",
  };
}

// Increment monthly message counter; auto-resets on new billing period.
export async function incrementUsage(shopId: string): Promise<void> {
  const rows = await db
    .select({
      id: merchantsTable.id,
      monthlyMessageCount: merchantsTable.monthlyMessageCount,
      usagePeriodStart: merchantsTable.usagePeriodStart,
    })
    .from(merchantsTable)
    .where(eq(merchantsTable.shopId, shopId))
    .limit(1);

  if (rows.length === 0) return;
  const merchant = rows[0];
  const periodStart = getBillingPeriodStart();

  const storedPeriodStart = merchant.usagePeriodStart;
  const needsReset = !storedPeriodStart || storedPeriodStart < periodStart;
  const newCount = needsReset ? 1 : (merchant.monthlyMessageCount ?? 0) + 1;

  await db
    .update(merchantsTable)
    .set({
      monthlyMessageCount: newCount,
      usagePeriodStart: needsReset ? periodStart : (storedPeriodStart ?? periodStart),
      updatedAt: new Date(),
    })
    .where(eq(merchantsTable.id, merchant.id));
}
