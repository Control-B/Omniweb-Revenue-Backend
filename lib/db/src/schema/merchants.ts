import { pgTable, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan", ["free", "starter", "pro"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "none",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
]);

export const merchantsTable = pgTable("merchants", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  shopId: text("shop_id").notNull().unique(),
  clerkUserId: text("clerk_user_id").unique(),
  passwordHash: text("password_hash"),
  apiKeyHash: text("api_key_hash"),
  apiKeyPrefix: text("api_key_prefix"),
  apiKeyCreatedAt: timestamp("api_key_created_at"),
  plan: planEnum("plan").notNull().default("free"),

  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").notNull().default("none"),
  currentPeriodEnd: timestamp("current_period_end"),

  monthlyMessageCount: integer("monthly_message_count").notNull().default(0),
  usagePeriodStart: timestamp("usage_period_start"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Merchant = typeof merchantsTable.$inferSelect;
export type InsertMerchant = typeof merchantsTable.$inferInsert;
