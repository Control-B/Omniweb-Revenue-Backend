import { type Request, type Response, type NextFunction } from "express";
import { checkUsage } from "../lib/plan-limits.js";
import { PLAN_NAMES } from "../lib/stripe.js";

/**
 * Middleware enforcing active subscriptions and monthly message limits on
 * widget endpoints (/api/chat, /api/voice).
 *
 * Two independent gates — either can trigger a 402:
 *
 * 1. **Subscription gate** (paid plans only):
 *    If the merchant is on a paid plan (starter / pro) but their subscription
 *    status is NOT "active" or "trialing", return 402 immediately — even if
 *    they have 0 messages used this month.
 *
 * 2. **Usage gate** (all plans):
 *    If the merchant has consumed all messages in their effective monthly
 *    allowance (free plan = 50, starter = 500, pro = 5 000), return 402.
 *    The effective allowance is always the *free* tier when the subscription
 *    is inactive, so an inactive paid merchant gets both gates applied.
 *
 * The shopId is read from req.body.
 * If shopId is absent the request passes through (other middleware validates it).
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
    const isPaidPlan = ["starter", "pro"].includes(status.plan);
    const isActiveSubscription = ["active", "trialing"].includes(status.subscriptionStatus);

    // Gate 1: paid plan with inactive subscription → block immediately
    if (isPaidPlan && !isActiveSubscription) {
      const planName = PLAN_NAMES[status.plan] ?? status.plan;
      res.status(402).json({
        error: "Subscription inactive",
        message:
          `Your ${planName} subscription is ${status.subscriptionStatus}. ` +
          `Please renew or upgrade your subscription to continue using the AI widget.`,
        plan: status.plan,
        effectivePlan: status.effectivePlan,
        subscriptionStatus: status.subscriptionStatus,
        upgradeUrl: "/dashboard/billing",
      });
      return;
    }

    // Gate 2: usage limit exhausted
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
  } catch {
    // Non-fatal: transient DB failure — let the request through rather than
    // blocking all widget traffic during an outage.
  }

  next();
}
