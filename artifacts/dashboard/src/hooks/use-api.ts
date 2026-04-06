import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

export interface WidgetConfig {
  shopId: string;
  greeting: string;
  persona: string;
  voiceId: string;
  accentColor: string;
  position: "bottom-right" | "bottom-left";
  widgetTitle: string;
  enabled: boolean;
}

export interface Voice {
  id: string;
  name: string;
  description: string;
}

export interface Session {
  sessionId: string;
  messageCount: number;
  firstMessage: string;
  lastActiveAt: string;
  createdAt: string;
}

export interface MerchantInfo {
  merchantId: string;
  shopId: string;
  email: string;
  plan: string;
  apiKeyPrefix: string | null;
  apiKeyCreatedAt: string | null;
  createdAt: string;
}

export interface BillingStatus {
  plan: string;
  planName: string;
  effectivePlan: string;
  effectivePlanName: string;
  subscriptionStatus: string;
  isSubscriptionActive: boolean;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
  usage: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  stripeConfigured: boolean;
}

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? response.statusText ?? "Request failed");
  }

  return response.json();
};

export function useWidgetConfig() {
  const { isAuthenticated } = useAuth();

  return useQuery<WidgetConfig>({
    queryKey: ["widgetConfig"],
    queryFn: () => apiFetch("/api/widget-config"),
    enabled: isAuthenticated,
  });
}

export function useUpdateWidgetConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<WidgetConfig>) =>
      apiFetch("/api/widget-config", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["widgetConfig"], data);
    },
  });
}

export function useVoices() {
  const { isAuthenticated } = useAuth();

  return useQuery<{ voices: Voice[] }>({
    queryKey: ["voices"],
    queryFn: () => apiFetch("/api/voices"),
    enabled: isAuthenticated,
  });
}

export function useConversations() {
  const { isAuthenticated, auth } = useAuth();

  return useQuery<{ sessions: Session[]; total: number }>({
    queryKey: ["conversations", auth?.shopId],
    queryFn: () => apiFetch("/api/conversations"),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
}

export function useMerchantInfo() {
  const { isAuthenticated } = useAuth();

  return useQuery<MerchantInfo>({
    queryKey: ["merchantInfo"],
    queryFn: () => apiFetch("/api/auth/me"),
    enabled: isAuthenticated,
  });
}

export function useRotateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch("/api/auth/rotate-key", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchantInfo"] });
    },
  });
}

export function useBillingStatus() {
  const { isAuthenticated } = useAuth();

  return useQuery<BillingStatus>({
    queryKey: ["billingStatus"],
    queryFn: () => apiFetch("/api/billing/status"),
    enabled: isAuthenticated,
  });
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (plan: string) =>
      apiFetch("/api/billing/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({ plan }),
      }) as Promise<{ url: string }>,
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: () =>
      apiFetch("/api/billing/create-portal-session", {
        method: "POST",
      }) as Promise<{ url: string }>,
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}
