import { type Request, type Response, type NextFunction } from "express";
import { checkUsage } from "../lib/plan-limits.js";
import { PLAN_NAMES } from "../lib/billing-config.js";
import { logger } from "../lib/logger.js";

/**
 * Enforces active subscriptions and monthly message limits on /api/chat and /api/voice.
 * Passes through if shopId is absent or the merchant is not found (other middleware handles those).
 * Fails closed (503) if the DB check itself errors.
 */
export async function requirePlanLimits(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const shopId = (req.body as { shopId?: string })?.shopId;
  if (!shopId || typeof shopId !== "string") {
    next();
    return;
  }

  try {
    const status = await checkUsage(shopId.slice(0, 200));

    // Unknown merchant — let the route handler issue its own 403
    if (!status.found) {
      next();
      return;
    }

    const isPaidPlan = ["starter", "pro"].includes(status.plan);
    const isActiveSubscription = ["active", "trialing"].includes(status.subscriptionStatus);

    // Gate 1: paid plan with inactive subscription
    if (isPaidPlan && !isActiveSubscription) {
      const planName = PLAN_NAMES[status.plan] ?? status.plan;
      res.status(402).json({
        error: "Subscription inactive",
        message: `Your ${planName} subscription is ${status.subscriptionStatus}. Please renew to continue using the AI widget.`,
        plan: status.plan,
        effectivePlan: status.effectivePlan,
        subscriptionStatus: status.subscriptionStatus,
        upgradeUrl: "/dashboard/billing",
      });
      return;
    }

    // Gate 2: usage limit reached
    if (!status.allowed) {
      const effectivePlanName = PLAN_NAMES[status.effectivePlan] ?? status.effectivePlan;
      res.status(402).json({
        error: "Plan limit reached",
        message: `You've used all ${status.limit} messages included in your ${effectivePlanName} plan this month. Upgrade to continue.`,
        plan: status.plan,
        effectivePlan: status.effectivePlan,
        subscriptionStatus: status.subscriptionStatus,
        used: status.used,
        limit: status.limit,
        upgradeUrl: "/dashboard/billing",
      });
      return;
    }
  } catch (err) {
    logger.error({ err, shopId }, "Plan limit check failed — failing closed");
    res.status(503).json({
      error: "Billing check unavailable",
      message: "Unable to verify plan limits. Please try again in a moment.",
      retryable: true,
    });
    return;
  }

  next();
}
