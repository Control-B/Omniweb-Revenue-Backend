import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan", ["free", "starter", "pro"]);

export const merchantsTable = pgTable("merchants", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  shopId: text("shop_id").notNull().unique(),
  passwordHash: text("password_hash"),
  apiKeyHash: text("api_key_hash"),
  apiKeyPrefix: text("api_key_prefix"),
  apiKeyCreatedAt: timestamp("api_key_created_at"),
  plan: planEnum("plan").notNull().default("free"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Merchant = typeof merchantsTable.$inferSelect;
export type InsertMerchant = typeof merchantsTable.$inferInsert;
