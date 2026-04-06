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

const fetchWithAuth = async (url: string, token: string | null, options: RequestInit = {}) => {
  if (!token) throw new Error("Unauthorized");

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
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
  const { credentials } = useAuth();

  return useQuery<WidgetConfig>({
    queryKey: ["widgetConfig", credentials?.shopId],
    queryFn: () => fetchWithAuth("/api/widget-config", credentials?.token ?? null),
    enabled: !!credentials,
  });
}

export function useUpdateWidgetConfig() {
  const { credentials } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<WidgetConfig>) =>
      fetchWithAuth("/api/widget-config", credentials?.token ?? null, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["widgetConfig", credentials?.shopId], data);
    },
  });
}

export function useVoices() {
  const { credentials } = useAuth();

  return useQuery<{ voices: Voice[] }>({
    queryKey: ["voices"],
    queryFn: () => fetchWithAuth("/api/voices", credentials?.token ?? null),
    enabled: !!credentials,
  });
}

export function useConversations() {
  const { credentials } = useAuth();

  return useQuery<{ sessions: Session[]; total: number }>({
    queryKey: ["conversations", credentials?.shopId],
    queryFn: () => fetchWithAuth("/api/conversations", credentials?.token ?? null),
    enabled: !!credentials?.shopId,
    refetchInterval: 30000,
  });
}

export function useMerchantInfo() {
  const { credentials } = useAuth();

  return useQuery<MerchantInfo>({
    queryKey: ["merchantInfo", credentials?.shopId],
    queryFn: () => fetchWithAuth("/api/auth/me", credentials?.token ?? null),
    enabled: !!credentials,
  });
}

export function useRotateApiKey() {
  const { credentials } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchWithAuth("/api/auth/rotate-key", credentials?.token ?? null, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchantInfo", credentials?.shopId] });
    },
  });
}
