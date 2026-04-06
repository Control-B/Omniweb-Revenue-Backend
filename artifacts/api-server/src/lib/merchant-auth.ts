import { randomUUID } from "crypto";
import { db, merchantsTable } from "@workspace/db";
import { and, eq, isNull, or } from "drizzle-orm";

interface ClerkUserProfile {
  clerkUserId: string;
  email: string;
}

export async function findMerchantByClerkUserId(clerkUserId: string) {
  const rows = await db
    .select({
      id: merchantsTable.id,
      shopId: merchantsTable.shopId,
      email: merchantsTable.email,
      plan: merchantsTable.plan,
      clerkUserId: merchantsTable.clerkUserId,
    })
    .from(merchantsTable)
    .where(eq(merchantsTable.clerkUserId, clerkUserId))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertMerchantFromClerk(profile: ClerkUserProfile, shopId?: string) {
  const normalizedEmail = profile.email.toLowerCase().trim();
  const normalizedShopId = typeof shopId === "string" && shopId.trim().length >= 3
    ? shopId.toLowerCase().trim()
    : null;

  const existingByClerk = await findMerchantByClerkUserId(profile.clerkUserId);
  if (existingByClerk) {
    if (existingByClerk.email !== normalizedEmail) {
      await db
        .update(merchantsTable)
        .set({ email: normalizedEmail, updatedAt: new Date() })
        .where(eq(merchantsTable.id, existingByClerk.id));
    }

    return {
      id: existingByClerk.id,
      shopId: existingByClerk.shopId,
      email: normalizedEmail,
      plan: existingByClerk.plan,
    };
  }

  const query = normalizedShopId
    ? or(eq(merchantsTable.email, normalizedEmail), eq(merchantsTable.shopId, normalizedShopId))
    : eq(merchantsTable.email, normalizedEmail);

  const candidateRows = await db
    .select({
      id: merchantsTable.id,
      shopId: merchantsTable.shopId,
      email: merchantsTable.email,
      plan: merchantsTable.plan,
      clerkUserId: merchantsTable.clerkUserId,
    })
    .from(merchantsTable)
    .where(query)
    .limit(1);

  const candidate = candidateRows[0] ?? null;
  if (candidate) {
    if (candidate.clerkUserId && candidate.clerkUserId !== profile.clerkUserId) {
      throw new Error("This account is already linked to another Clerk user.");
    }

    if (!normalizedShopId && !candidate.shopId) {
      throw new Error("A Shopify shop domain is required to finish account setup.");
    }

    await db
      .update(merchantsTable)
      .set({
        email: normalizedEmail,
        shopId: normalizedShopId ?? candidate.shopId,
        clerkUserId: profile.clerkUserId,
        updatedAt: new Date(),
      })
      .where(eq(merchantsTable.id, candidate.id));

    return {
      id: candidate.id,
      shopId: normalizedShopId ?? candidate.shopId,
      email: normalizedEmail,
      plan: candidate.plan,
    };
  }

  if (!normalizedShopId) {
    throw new Error("A Shopify shop domain is required to create a new merchant account.");
  }

  const now = new Date();
  const id = randomUUID();
  await db.insert(merchantsTable).values({
    id,
    email: normalizedEmail,
    shopId: normalizedShopId,
    clerkUserId: profile.clerkUserId,
    plan: "free",
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    shopId: normalizedShopId,
    email: normalizedEmail,
    plan: "free" as const,
  };
}