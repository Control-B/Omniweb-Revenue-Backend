import { db, widgetConfigsTable, merchantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

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

export interface PublicWidgetConfig {
  shopId: string;
  widgetTitle: string;
  greeting: string;
  accentColor: string;
  position: "bottom-right" | "bottom-left";
  enabled: boolean;
  voiceId: string;
}

const DEFAULT_CONFIG: Omit<WidgetConfig, "shopId"> = {
  greeting: "Hi! 👋 I'm your AI sales assistant. How can I help you today?",
  persona:
    "You are a friendly, knowledgeable, and helpful AI sales assistant for an online store. You help shoppers find products, answer questions about products, pricing, shipping, and returns, and guide them toward making a purchase. Be concise, warm, and helpful. Never be pushy.",
  voiceId: "21m00Tcm4TlvDq8ikWAM",
  accentColor: "#E63946",
  position: "bottom-right",
  widgetTitle: "Sales Assistant",
  enabled: true,
};

const DEMO_SHOP_ID = "demo.myshopify.com";

function rowToConfig(row: typeof widgetConfigsTable.$inferSelect): WidgetConfig {
  return {
    shopId: row.shopId,
    greeting: row.greeting,
    persona: row.persona,
    voiceId: row.voiceId,
    accentColor: row.accentColor,
    position: row.position,
    widgetTitle: row.widgetTitle,
    enabled: row.enabled,
  };
}

async function ensureMerchantExists(shopId: string): Promise<void> {
  await db
    .insert(merchantsTable)
    .values({
      id: randomUUID(),
      email: `${shopId.replace(/[^a-z0-9]/gi, "-")}@placeholder.omniweb.dev`,
      shopId,
      plan: shopId === DEMO_SHOP_ID ? "pro" : "free",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: merchantsTable.shopId });
}

export async function isShopRegistered(shopId: string): Promise<boolean> {
  const rows = await db
    .select({
      shopId: widgetConfigsTable.shopId,
      registeredAt: widgetConfigsTable.registeredAt,
    })
    .from(widgetConfigsTable)
    .where(eq(widgetConfigsTable.shopId, shopId))
    .limit(1);
  return rows.length > 0 && rows[0].registeredAt !== null;
}

export async function getWidgetConfig(shopId: string): Promise<WidgetConfig> {
  const rows = await db
    .select()
    .from(widgetConfigsTable)
    .where(eq(widgetConfigsTable.shopId, shopId))
    .limit(1);

  if (rows.length > 0) {
    return rowToConfig(rows[0]);
  }

  const isDemoShop = shopId === DEMO_SHOP_ID;

  await ensureMerchantExists(shopId);

  await db.insert(widgetConfigsTable).values({
    shopId,
    ...DEFAULT_CONFIG,
    registeredAt: isDemoShop ? new Date() : null,
  });

  return { shopId, ...DEFAULT_CONFIG };
}

export async function updateWidgetConfig(
  shopId: string,
  updates: Partial<Omit<WidgetConfig, "shopId">>
): Promise<WidgetConfig> {
  const existing = await getWidgetConfig(shopId);
  const merged = { ...existing, ...updates };

  await ensureMerchantExists(shopId);

  await db
    .insert(widgetConfigsTable)
    .values({
      shopId,
      greeting: merged.greeting,
      persona: merged.persona,
      voiceId: merged.voiceId,
      accentColor: merged.accentColor,
      position: merged.position,
      widgetTitle: merged.widgetTitle,
      enabled: merged.enabled,
      registeredAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: widgetConfigsTable.shopId,
      set: {
        greeting: merged.greeting,
        persona: merged.persona,
        voiceId: merged.voiceId,
        accentColor: merged.accentColor,
        position: merged.position,
        widgetTitle: merged.widgetTitle,
        enabled: merged.enabled,
        registeredAt: new Date(),
        updatedAt: new Date(),
      },
    });

  return merged;
}

export async function getPublicWidgetConfig(shopId: string): Promise<PublicWidgetConfig> {
  const config = await getWidgetConfig(shopId);
  return {
    shopId: config.shopId,
    widgetTitle: config.widgetTitle,
    greeting: config.greeting,
    accentColor: config.accentColor,
    position: config.position,
    enabled: config.enabled,
    voiceId: config.voiceId,
  };
}

export function getAvailableVoices(): Array<{ id: string; name: string; description: string }> {
  return [
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Calm, professional female voice" },
    { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "Strong, confident female voice" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Soft, warm female voice" },
    { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Well-rounded male voice" },
    { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", description: "Emotional, expressive female voice" },
    { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "Deep, mature male voice" },
    { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", description: "Crisp, authoritative male voice" },
    { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Neutral, clear male voice" },
    { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", description: "Raspy, dynamic male voice" },
  ];
}
