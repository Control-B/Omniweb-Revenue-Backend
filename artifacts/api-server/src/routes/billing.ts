import { Router, type IRouter, type Request, type Response } from "express";
import { db, merchantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getStripe, PLAN_PRICE_IDS, isStripeConfigured, PLAN_LIMITS, PLAN_NAMES } from "../lib/stripe.js";
import { requireSessionAuth } from "../middleware/api-key.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// Uses server-side env vars only — never client-supplied headers (open-redirect risk)
function getAppBaseUrl(): string {
  if (process.env["STRIPE_RETURN_URL"]) {
    return process.env["STRIPE_RETURN_URL"].replace(/\/$/, "");
  }
  if (process.env["REPLIT_DEV_DOMAIN"]) {
    return `https://${process.env["REPLIT_DEV_DOMAIN"]}/dashboard`;
  }
  return "https://localhost/dashboard";
}

function stripeNotConfigured(res: Response): void {
  res.status(503).json({
    error: "Stripe not configured",
    message: "Stripe is not configured for this deployment. Set STRIPE_SECRET_KEY to enable billing.",
  });
}

router.post(
  "/billing/create-checkout-session",
  requireSessionAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!isStripeConfigured()) { stripeNotConfigured(res); return; }

    const merchant = req.merchant!;
    const { plan } = req.body as { plan?: string };

    if (!plan || !["starter", "pro"].includes(plan)) {
      res.status(400).json({ error: "plan must be 'starter' or 'pro'" });
      return;
    }

    const priceId = PLAN_PRICE_IDS[plan];
    if (!priceId) {
      res.status(503).json({
        error: "Plan price not configured",
        message: `STRIPE_${plan.toUpperCase()}_PRICE_ID is not set.`,
      });
      return;
    }

    const stripe = getStripe()!;
    const baseUrl = getAppBaseUrl();

    try {
      const rows = await db
        .select({ stripeCustomerId: merchantsTable.stripeCustomerId })
        .from(merchantsTable)
        .where(eq(merchantsTable.id, merchant.id))
        .limit(1);

      const existingCustomerId = rows[0]?.stripeCustomerId ?? undefined;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        customer: existingCustomerId,
        customer_email: existingCustomerId ? undefined : merchant.email,
        metadata: { merchantId: merchant.id, shopId: merchant.shopId, plan },
        success_url: `${baseUrl}/billing?session_id={CHECKOUT_SESSION_ID}&status=success`,
        cancel_url: `${baseUrl}/billing?status=canceled`,
      });

      res.json({ url: session.url });
    } catch (err) {
      logger.error({ err }, "Stripe checkout session error");
      res.status(502).json({ error: "Failed to create checkout session. Please try again." });
    }
  }
);

router.post(
  "/billing/create-portal-session",
  requireSessionAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!isStripeConfigured()) { stripeNotConfigured(res); return; }

    const merchant = req.merchant!;
    const baseUrl = getAppBaseUrl();

    try {
      const rows = await db
        .select({ stripeCustomerId: merchantsTable.stripeCustomerId })
        .from(merchantsTable)
        .where(eq(merchantsTable.id, merchant.id))
        .limit(1);

      const customerId = rows[0]?.stripeCustomerId;
      if (!customerId) {
        res.status(400).json({ error: "No Stripe customer found. Please subscribe first." });
        return;
      }

      const stripe = getStripe()!;
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl}/billing`,
      });

      res.json({ url: session.url });
    } catch (err) {
      logger.error({ err }, "Stripe portal session error");
      res.status(502).json({ error: "Failed to create portal session. Please try again." });
    }
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
      stripeConfigured: isStripeConfigured(),
    });
  }
);

router.post(
  "/billing/webhook",
  async (req: Request, res: Response): Promise<void> => {
    if (!isStripeConfigured()) { stripeNotConfigured(res); return; }

    const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
    if (!webhookSecret) {
      logger.error("STRIPE_WEBHOOK_SECRET is not set — webhook rejected (fail closed)");
      res.status(400).json({
        error: "Webhook misconfigured",
        message: "STRIPE_WEBHOOK_SECRET must be set to receive webhook events.",
      });
      return;
    }

    const stripe = getStripe()!;
    const sig = req.headers["stripe-signature"] as string | undefined;

    if (!sig) {
      logger.warn("Stripe webhook received without stripe-signature header — rejected");
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch (err) {
      logger.warn({ err }, "Stripe webhook signature verification failed");
      res.status(400).json({ error: "Invalid webhook signature" });
      return;
    }

    try {
      await handleStripeEvent(event as { type: string; data: { object: Record<string, unknown> } });
      res.json({ received: true });
    } catch (err) {
      logger.error({ err, type: (event as { type: string }).type }, "Stripe webhook handler error");
      res.status(500).json({ error: "Webhook handler failed" });
    }
  }
);

async function handleStripeEvent(event: { type: string; data: { object: Record<string, unknown> } }): Promise<void> {
  const obj = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = obj as { metadata?: Record<string, string>; customer?: string; subscription?: string };
      const merchantId = session.metadata?.["merchantId"];
      const plan = session.metadata?.["plan"] ?? "free";
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

      if (!merchantId) break;

      await db
        .update(merchantsTable)
        .set({
          plan: plan as "free" | "starter" | "pro",
          subscriptionStatus: "active",
          stripeCustomerId: customerId ?? undefined,
          stripeSubscriptionId: subscriptionId ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(merchantsTable.id, merchantId));

      logger.info({ merchantId, plan }, "Checkout completed — plan activated");
      break;
    }

    case "customer.subscription.created": {
      const sub = obj as {
        id: string;
        status: string;
        current_period_end: number;
        customer: string;
        metadata?: Record<string, string>;
        items?: { data?: Array<{ price?: { id: string } }> };
      };
      const customerId = sub.customer;
      const merchantId = await resolveMerchantIdFromSubscription(sub.id, customerId, sub.metadata);
      if (!merchantId) break;

      const plan = getPlanFromPriceId(sub.items?.data?.[0]?.price?.id);

      await db
        .update(merchantsTable)
        .set({
          plan: plan as "free" | "starter" | "pro",
          subscriptionStatus: mapStripeStatus(sub.status),
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          updatedAt: new Date(),
        })
        .where(eq(merchantsTable.id, merchantId));

      logger.info({ merchantId, plan, status: sub.status }, "Subscription created");
      break;
    }

    case "customer.subscription.updated": {
      const sub = obj as {
        id: string;
        status: string;
        current_period_end: number;
        customer: string;
        metadata?: Record<string, string>;
        items?: { data?: Array<{ price?: { id: string } }> };
      };
      const customerId = sub.customer;
      const merchantId = await resolveMerchantIdFromSubscription(sub.id, customerId, sub.metadata);
      if (!merchantId) break;

      const plan = getPlanFromPriceId(sub.items?.data?.[0]?.price?.id);

      await db
        .update(merchantsTable)
        .set({
          plan: plan as "free" | "starter" | "pro",
          subscriptionStatus: mapStripeStatus(sub.status),
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          updatedAt: new Date(),
        })
        .where(eq(merchantsTable.id, merchantId));

      logger.info({ merchantId, plan, status: sub.status }, "Subscription updated");
      break;
    }

    case "customer.subscription.deleted": {
      const sub = obj as { customer: string };
      const customerId = sub.customer;

      const rows = await db
        .select({ id: merchantsTable.id })
        .from(merchantsTable)
        .where(eq(merchantsTable.stripeCustomerId, customerId))
        .limit(1);

      if (rows.length === 0) break;
      const merchantId = rows[0].id;

      await db
        .update(merchantsTable)
        .set({
          plan: "free",
          subscriptionStatus: "canceled",
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
          updatedAt: new Date(),
        })
        .where(eq(merchantsTable.id, merchantId));

      logger.info({ merchantId }, "Subscription cancelled — downgraded to free");
      break;
    }

    case "invoice.payment_failed": {
      const invoice = obj as { customer: string };
      const customerId = invoice.customer;

      const rows = await db
        .select({ id: merchantsTable.id })
        .from(merchantsTable)
        .where(eq(merchantsTable.stripeCustomerId, customerId))
        .limit(1);

      if (rows.length === 0) break;

      await db
        .update(merchantsTable)
        .set({ subscriptionStatus: "past_due", updatedAt: new Date() })
        .where(eq(merchantsTable.id, rows[0].id));

      logger.warn({ merchantId: rows[0].id }, "Invoice payment failed");
      break;
    }

    default:
      logger.info({ type: event.type }, "Unhandled Stripe event");
  }
}

// Resolve by customerId → subscriptionId → metadata.merchantId (in that order)
async function resolveMerchantIdFromSubscription(
  subscriptionId: string,
  customerId: string,
  metadata?: Record<string, string>,
): Promise<string | null> {
  // 1. By customerId
  const byCustomer = await db
    .select({ id: merchantsTable.id })
    .from(merchantsTable)
    .where(eq(merchantsTable.stripeCustomerId, customerId))
    .limit(1);
  if (byCustomer.length > 0) return byCustomer[0].id;

  // 2. By subscriptionId (handles re-sent / re-created subscriptions)
  const bySubscription = await db
    .select({ id: merchantsTable.id })
    .from(merchantsTable)
    .where(eq(merchantsTable.stripeSubscriptionId, subscriptionId))
    .limit(1);
  if (bySubscription.length > 0) return bySubscription[0].id;

  // 3. By metadata merchantId (set in checkout session metadata)
  const metaMerchantId = metadata?.["merchantId"];
  if (metaMerchantId) {
    const byMeta = await db
      .select({ id: merchantsTable.id })
      .from(merchantsTable)
      .where(eq(merchantsTable.id, metaMerchantId))
      .limit(1);
    if (byMeta.length > 0) return byMeta[0].id;
  }

  logger.warn({ subscriptionId, customerId }, "Could not resolve merchant from subscription event");
  return null;
}

function mapStripeStatus(status: string): "none" | "trialing" | "active" | "past_due" | "canceled" | "incomplete" {
  switch (status) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "past_due": return "past_due";
    case "canceled": return "canceled";
    case "incomplete": return "incomplete";
    default: return "none";
  }
}

function getPlanFromPriceId(priceId?: string): string {
  if (!priceId) return "free";
  if (priceId === PLAN_PRICE_IDS["starter"]) return "starter";
  if (priceId === PLAN_PRICE_IDS["pro"]) return "pro";
  return "free";
}

export default router;
