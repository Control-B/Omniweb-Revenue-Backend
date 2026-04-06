import { Router, type IRouter, type Request, type Response } from "express";
import { db, merchantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PLAN_LIMITS, PLAN_NAMES, isBillingEnabled } from "../lib/billing-config.js";
import { requireSessionAuth } from "../middleware/api-key.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function billingUnavailable(res: Response): void {
  res.status(503).json({
    error: "Billing disabled",
    message: "Billing integration is currently disabled for this deployment.",
  });
}

router.post(
  "/billing/create-checkout-session",
  requireSessionAuth,
  async (req: Request, res: Response): Promise<void> => {
    logger.info({ merchantId: req.merchant?.id }, "Checkout requested while billing integration is disabled");
    billingUnavailable(res);
  }
);

router.post(
  "/billing/create-portal-session",
  requireSessionAuth,
  async (req: Request, res: Response): Promise<void> => {
    logger.info({ merchantId: req.merchant?.id }, "Portal requested while billing integration is disabled");
    billingUnavailable(res);
  }
);

router.get(
  "/billing/status",
  requireSessionAuth,
  async (req: Request, res: Response): Promise<void> => {
    const merchant = req.merchant!;

    const rows = await db
      .select({
        plan: merchantsTable.plan,
        subscriptionStatus: merchantsTable.subscriptionStatus,
        stripeCustomerId: merchantsTable.stripeCustomerId,
        stripeSubscriptionId: merchantsTable.stripeSubscriptionId,
        currentPeriodEnd: merchantsTable.currentPeriodEnd,
        monthlyMessageCount: merchantsTable.monthlyMessageCount,
        usagePeriodStart: merchantsTable.usagePeriodStart,
      })
      .from(merchantsTable)
      .where(eq(merchantsTable.id, merchant.id))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Merchant not found" });
      return;
    }

    const m = rows[0];
    const plan = m.plan ?? "free";
    const subscriptionStatus = m.subscriptionStatus ?? "none";

    // Mirror enforcement logic: inactive subscriptions use free-tier limits
    const isSubscriptionActive = ["active", "trialing"].includes(subscriptionStatus);
    const isPaidPlan = ["starter", "pro"].includes(plan);
    const effectivePlan = isPaidPlan && !isSubscriptionActive ? "free" : plan;

    const limit = PLAN_LIMITS[effectivePlan] ?? 50;

    // Mirror period-reset logic: if stored period is before the current month, treat usage as 0
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const storedPeriod = m.usagePeriodStart;
    const used = storedPeriod && storedPeriod >= periodStart ? (m.monthlyMessageCount ?? 0) : 0;

    res.json({
      plan,
      planName: PLAN_NAMES[plan] ?? plan,
      effectivePlan,
      effectivePlanName: PLAN_NAMES[effectivePlan] ?? effectivePlan,
      subscriptionStatus,
      isSubscriptionActive,
      currentPeriodEnd: m.currentPeriodEnd?.toISOString() ?? null,
      hasCustomer: !!m.stripeCustomerId,
      usage: {
        used,
        limit,
        remaining: Math.max(0, limit - used),
        percentage: Math.min(100, Math.round((used / limit) * 100)),
      },
      stripeConfigured: isBillingEnabled(),
    });
  }
);

router.post(
  "/billing/webhook",
  async (req: Request, res: Response): Promise<void> => {
    logger.info({ headers: req.headers }, "Ignoring billing webhook because billing integration is disabled");
    res.status(410).json({
      error: "Billing disabled",
      message: "Webhook processing is disabled for this deployment.",
    });
  }
);

export default router;
