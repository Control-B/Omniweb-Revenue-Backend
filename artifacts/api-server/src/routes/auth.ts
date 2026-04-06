import { Router, type IRouter, type Request, type Response } from "express";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { db, merchantsTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { signToken } from "../lib/jwt.js";
import { requireAuth, hashApiKey } from "../middleware/api-key.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function generateApiKey(): string {
  return `ow_live_${randomBytes(24).toString("hex")}`;
}

router.post("/auth/signup", async (req: Request, res: Response): Promise<void> => {
  const { email, shopId, password } = req.body as {
    email?: string;
    shopId?: string;
    password?: string;
  };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }
  if (!shopId || typeof shopId !== "string" || shopId.trim().length < 3) {
    res.status(400).json({ error: "Valid shopId is required (e.g., mystore.myshopify.com)" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedShop = shopId.toLowerCase().trim();

  try {
    const existingRows = await db
      .select({ id: merchantsTable.id, passwordHash: merchantsTable.passwordHash, email: merchantsTable.email })
      .from(merchantsTable)
      .where(eq(merchantsTable.shopId, normalizedShop))
      .limit(1);

    if (existingRows.length > 0 && existingRows[0].passwordHash) {
      res.status(409).json({ error: "This shop domain is already registered" });
      return;
    }

    const emailRows = await db
      .select({ id: merchantsTable.id })
      .from(merchantsTable)
      .where(and(eq(merchantsTable.email, normalizedEmail), isNotNull(merchantsTable.passwordHash)))
      .limit(1);

    if (emailRows.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const apiKeyPrefix = apiKey.slice(0, 16);
    const now = new Date();

    if (existingRows.length > 0) {
      await db
        .update(merchantsTable)
        .set({
          email: normalizedEmail,
          passwordHash,
          apiKeyHash,
          apiKeyPrefix,
          apiKeyCreatedAt: now,
          updatedAt: now,
        })
        .where(eq(merchantsTable.shopId, normalizedShop));
    } else {
      const { randomUUID } = await import("crypto");
      await db.insert(merchantsTable).values({
        id: randomUUID(),
        email: normalizedEmail,
        shopId: normalizedShop,
        passwordHash,
        apiKeyHash,
        apiKeyPrefix,
        apiKeyCreatedAt: now,
        plan: "free",
        createdAt: now,
        updatedAt: now,
      });
    }

    const merchantRow = await db
      .select({ id: merchantsTable.id })
      .from(merchantsTable)
      .where(eq(merchantsTable.shopId, normalizedShop))
      .limit(1);

    const token = signToken({
      merchantId: merchantRow[0]!.id,
      shopId: normalizedShop,
      email: normalizedEmail,
    });

    logger.info({ shopId: normalizedShop }, "Merchant signed up");

    res.status(201).json({
      token,
      apiKey,
      shopId: normalizedShop,
      email: normalizedEmail,
      message: "Account created. Save your API key — it will not be shown again.",
    });
  } catch (err) {
    logger.error({ err }, "Signup error");
    res.status(500).json({ error: "Signup failed. Please try again." });
  }
});

router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  if (!password || typeof password !== "string") {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(merchantsTable)
      .where(eq(merchantsTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (rows.length === 0 || !rows[0].passwordHash) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const merchant = rows[0];
    const passwordHash = merchant.passwordHash!;
    const valid = await bcrypt.compare(password, passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({
      merchantId: merchant.id,
      shopId: merchant.shopId,
      email: merchant.email,
    });

    logger.info({ shopId: merchant.shopId }, "Merchant logged in");

    res.json({
      token,
      shopId: merchant.shopId,
      email: merchant.email,
      plan: merchant.plan,
    });
  } catch (err) {
    logger.error({ err }, "Login error");
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.get("/auth/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const merchant = req.merchant!;
  const rows = await db
    .select({
      plan: merchantsTable.plan,
      apiKeyPrefix: merchantsTable.apiKeyPrefix,
      apiKeyCreatedAt: merchantsTable.apiKeyCreatedAt,
      createdAt: merchantsTable.createdAt,
    })
    .from(merchantsTable)
    .where(eq(merchantsTable.id, merchant.id))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Merchant not found" });
    return;
  }

  res.json({
    merchantId: merchant.id,
    shopId: merchant.shopId,
    email: merchant.email,
    plan: rows[0].plan,
    apiKeyPrefix: rows[0].apiKeyPrefix,
    apiKeyCreatedAt: rows[0].apiKeyCreatedAt,
    createdAt: rows[0].createdAt,
  });
});

router.post("/auth/rotate-key", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const merchant = req.merchant!;

  try {
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const apiKeyPrefix = apiKey.slice(0, 16);
    const now = new Date();

    await db
      .update(merchantsTable)
      .set({ apiKeyHash, apiKeyPrefix, apiKeyCreatedAt: now, updatedAt: now })
      .where(eq(merchantsTable.id, merchant.id));

    logger.info({ shopId: merchant.shopId }, "API key rotated");

    res.json({
      apiKey,
      apiKeyPrefix,
      apiKeyCreatedAt: now.toISOString(),
      message: "New API key generated. Save it now — it will not be shown again.",
    });
  } catch (err) {
    logger.error({ err }, "Rotate key error");
    res.status(500).json({ error: "Failed to rotate API key. Please try again." });
  }
});

export default router;
