export const PLAN_LIMITS: Record<string, number> = {
  free: 50,
  starter: 500,
  pro: 5000,
};

export const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
};

export const PLAN_PRICES: Record<string, string> = {
  free: "$0/mo",
  starter: "$29/mo",
  pro: "$99/mo",
};

export function isBillingEnabled(): boolean {
  return false;
}