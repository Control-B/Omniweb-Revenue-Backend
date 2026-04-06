import { useEffect } from "react";
import { useLocation } from "wouter";
import { useBillingStatus, useCreateCheckoutSession, useCreatePortalSession } from "@/hooks/use-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CreditCard,
  Loader2,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  trialing: { label: "Trial", variant: "secondary" },
  past_due: { label: "Past Due", variant: "destructive" },
  canceled: { label: "Canceled", variant: "destructive" },
  none: { label: "Free Plan", variant: "outline" },
  incomplete: { label: "Incomplete", variant: "destructive" },
};

export default function Billing() {
  const { data: billing, isLoading, refetch } = useBillingStatus();
  const checkout = useCreateCheckoutSession();
  const portal = useCreatePortalSession();
  const [location] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status === "success") {
      toast.success("Subscription activated!", {
        description: "Your plan has been upgraded. It may take a moment to reflect.",
      });
      void refetch();
      window.history.replaceState({}, "", location);
    } else if (status === "canceled") {
      toast.info("Checkout canceled", { description: "No changes were made to your subscription." });
      window.history.replaceState({}, "", location);
    }
  }, [location, refetch]);

  const handleUpgrade = async (plan: string) => {
    if (!billing?.stripeConfigured) {
      toast.error("Billing unavailable", {
        description: "Billing is currently disabled for this deployment. Contact support to re-enable upgrades.",
      });
      return;
    }
    try {
      await checkout.mutateAsync(plan);
    } catch (err) {
      toast.error("Checkout failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  const handlePortal = async () => {
    try {
      await portal.mutateAsync();
    } catch (err) {
      toast.error("Portal failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!billing) {
    return <div className="text-muted-foreground py-12 text-center">Could not load billing information.</div>;
  }

  const statusInfo = STATUS_LABELS[billing.subscriptionStatus] ?? STATUS_LABELS["none"]!;
  const isPastDue = billing.subscriptionStatus === "past_due";
  const isOnPaidPlan = ["starter", "pro"].includes(billing.plan);
  const renewalDate = billing.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const usagePercent = billing.usage.percentage;
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = usagePercent >= 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your plan and usage</p>
      </div>

      {isPastDue && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">
            Your last payment failed. Please update your payment method to avoid service interruption.
          </AlertDescription>
        </Alert>
      )}

      {isOnPaidPlan && !billing.isSubscriptionActive && billing.subscriptionStatus !== "past_due" && (
        <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Your <strong>{billing.planName}</strong> subscription is <strong>{billing.subscriptionStatus}</strong>.
            The AI widget is operating under the Free plan limits ({billing.usage.limit} messages/month) until you renew.
          </AlertDescription>
        </Alert>
      )}

      {!billing.stripeConfigured && (
        <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Billing is currently disabled for this deployment. Upgrade buttons are unavailable.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard size={20} />
                Current Plan
              </CardTitle>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <CardDescription>
              {isOnPaidPlan
                ? `Your ${billing.planName} subscription`
                : "You are on the free plan"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{billing.planName}</span>
              {billing.plan === "starter" && (
                <span className="text-muted-foreground text-sm">$29 / month</span>
              )}
              {billing.plan === "pro" && (
                <span className="text-muted-foreground text-sm">$99 / month</span>
              )}
            </div>

            {renewalDate && (
              <p className="text-sm text-muted-foreground">
                <CheckCircle2 className="inline h-4 w-4 text-green-500 mr-1" />
                Renews on {renewalDate}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              {isOnPaidPlan && billing.hasCustomer ? (
                <Button
                  variant="outline"
                  onClick={handlePortal}
                  disabled={portal.isPending || !billing.stripeConfigured}
                  data-testid="button-manage-subscription"
                >
                  {portal.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink size={16} className="mr-2" />
                  )}
                  Manage Subscription
                </Button>
              ) : (
                <>
                  {billing.plan !== "starter" && billing.plan !== "pro" && (
                    <Button
                      onClick={() => handleUpgrade("starter")}
                      disabled={checkout.isPending || !billing.stripeConfigured}
                      data-testid="button-upgrade-starter"
                    >
                      {checkout.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUpRight size={16} className="mr-2" />
                      )}
                      Upgrade to Starter
                    </Button>
                  )}
                  {billing.plan === "starter" && (
                    <Button
                      onClick={() => handleUpgrade("pro")}
                      disabled={checkout.isPending || !billing.stripeConfigured}
                      data-testid="button-upgrade-pro"
                    >
                      {checkout.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Zap size={16} className="mr-2" />
                      )}
                      Upgrade to Pro
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap size={20} />
              Usage This Month
            </CardTitle>
            <CardDescription>
              AI messages used in the current billing period
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Messages used</span>
              <span className={`font-medium ${isAtLimit ? "text-destructive" : isNearLimit ? "text-amber-600" : ""}`}>
                {billing.usage.used.toLocaleString()} / {billing.usage.limit.toLocaleString()}
              </span>
            </div>
            <Progress
              value={usagePercent}
              className={`h-2 ${isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-amber-500" : ""}`}
              data-testid="usage-progress-bar"
            />
            <div className="text-xs text-muted-foreground">
              {isAtLimit ? (
                <span className="text-destructive font-medium">
                  Limit reached — upgrade to send more messages
                </span>
              ) : isNearLimit ? (
                <span className="text-amber-600">
                  {billing.usage.remaining.toLocaleString()} messages remaining — consider upgrading
                </span>
              ) : (
                <span>{billing.usage.remaining.toLocaleString()} messages remaining this month</span>
              )}
            </div>

            {billing.plan === "free" && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => handleUpgrade("starter")}
                disabled={checkout.isPending || !billing.stripeConfigured}
              >
                <ArrowUpRight size={14} className="mr-1" />
                Get 500 messages/month with Starter
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compare Plans</CardTitle>
          <CardDescription>Choose the plan that fits your store</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[
              { name: "Free", price: "$0/mo", messages: "50 messages/mo", key: "free" },
              { name: "Starter", price: "$29/mo", messages: "500 messages/mo", key: "starter" },
              { name: "Pro", price: "$99/mo", messages: "5,000 messages/mo", key: "pro" },
            ].map((plan) => (
              <div
                key={plan.key}
                className={`rounded-lg border p-4 ${billing.plan === plan.key ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <div className="font-semibold mb-1">{plan.name}</div>
                <div className="text-muted-foreground text-xs mb-2">{plan.price}</div>
                <div className="text-foreground font-medium">{plan.messages}</div>
                {billing.plan === plan.key && (
                  <Badge className="mt-2" variant="secondary">Current</Badge>
                )}
                {billing.plan !== plan.key && ["starter", "pro"].includes(plan.key) && (
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    variant="outline"
                    onClick={() => handleUpgrade(plan.key)}
                    disabled={checkout.isPending || !billing.stripeConfigured || billing.plan === "pro"}
                    data-testid={`button-plan-${plan.key}`}
                  >
                    {billing.plan === "pro" && plan.key === "starter" ? "Downgrade" : "Upgrade"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
