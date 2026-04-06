import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, LayoutDashboard, Zap, Shield, MessageSquare } from "lucide-react";

const plans = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started and see if Omniweb fits your store",
    messages: "50 AI messages / month",
    badge: null,
    features: [
      "50 AI chat messages per month",
      "1 Shopify store",
      "Product context injection",
      "Chat widget customization",
      "Community support",
    ],
    cta: "Get Started Free",
    ctaVariant: "outline" as const,
    href: "/signup",
  },
  {
    key: "starter",
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "For growing stores ready to turn browsers into buyers",
    messages: "500 AI messages / month",
    badge: "Most Popular",
    features: [
      "500 AI chat messages per month",
      "1 Shopify store",
      "Product context injection",
      "Voice responses (ElevenLabs)",
      "Widget branding customization",
      "Conversation history",
      "Email support",
    ],
    cta: "Start Starter Plan",
    ctaVariant: "default" as const,
    plan: "starter",
  },
  {
    key: "pro",
    name: "Pro",
    price: "$99",
    period: "/month",
    description: "High-volume stores that want every shopper assisted",
    messages: "5,000 AI messages / month",
    badge: null,
    features: [
      "5,000 AI chat messages per month",
      "1 Shopify store",
      "Product context injection",
      "Voice responses (ElevenLabs)",
      "Advanced widget customization",
      "Conversation analytics",
      "API key management",
      "Priority support",
    ],
    cta: "Start Pro Plan",
    ctaVariant: "outline" as const,
    plan: "pro",
  },
];

const faqs = [
  {
    q: "What counts as an AI message?",
    a: "Each message a shopper sends to the widget counts as one AI message. System messages and configuration do not count.",
  },
  {
    q: "Can I change plans anytime?",
    a: "Yes. You can manage plan changes from the Billing page whenever billing is enabled for your deployment.",
  },
  {
    q: "What happens when I hit my message limit?",
    a: "The widget will let your shoppers know the AI is temporarily unavailable. No hidden overages — ever.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — the Free plan gives you 50 messages to try Omniweb with real shoppers at no cost.",
  },
];

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleUpgrade = async (plan: string) => {
    setLoadingPlan(plan);
    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const body = await res.json() as { url?: string; error?: string };
      if (res.ok && body.url) {
        window.location.href = body.url;
      } else if (res.status === 401) {
        window.location.href = "/signup";
      } else {
        alert(body.error ?? "Could not start checkout. Please sign in first.");
        window.location.href = "/";
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <nav className="bg-white dark:bg-slate-900 border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <LayoutDashboard size={20} />
          </div>
          <span className="font-semibold text-lg tracking-tight">Omniweb</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Get Started Free</Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <Badge variant="secondary" className="mb-4">Pricing</Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Add an AI sales assistant to your Shopify store with one script tag. Pay only for what you use.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {plans.map((plan) => (
            <Card
              key={plan.key}
              className={`relative flex flex-col ${plan.badge ? "border-primary shadow-lg ring-1 ring-primary/20" : ""}`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3">{plan.badge}</Badge>
                </div>
              )}
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-primary mt-1">
                  <MessageSquare size={14} />
                  {plan.messages}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check size={16} className="text-green-500 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {plan.key === "free" ? (
                    <Link href={plan.href!}>
                      <Button
                        variant={plan.ctaVariant}
                        className="w-full"
                        data-testid={`button-pricing-${plan.key}`}
                      >
                        {plan.cta}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      variant={plan.ctaVariant}
                      className="w-full"
                      onClick={() => handleUpgrade(plan.plan!)}
                      disabled={loadingPlan === plan.plan}
                      data-testid={`button-pricing-${plan.key}`}
                    >
                      {loadingPlan === plan.plan ? "Loading..." : plan.cta}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16 text-center">
          {[
            { icon: Zap, title: "Instant Setup", body: "One script tag in your Shopify theme. No developer needed." },
            { icon: Shield, title: "No Hidden Fees", body: "Flat monthly price. No per-message overage charges, ever." },
            { icon: MessageSquare, title: "AI-Powered", body: "GPT-4o with full knowledge of your products and prices." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col items-center gap-3 p-6 rounded-xl bg-white dark:bg-slate-900 border border-border">
              <div className="bg-primary/10 rounded-full p-3 text-primary">
                <Icon size={24} />
              </div>
              <div className="font-semibold">{title}</div>
              <div className="text-sm text-muted-foreground">{body}</div>
            </div>
          ))}
        </div>

        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map(({ q, a }) => (
              <div key={q} className="bg-white dark:bg-slate-900 border border-border rounded-lg p-5">
                <div className="font-semibold mb-2">{q}</div>
                <div className="text-sm text-muted-foreground">{a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
