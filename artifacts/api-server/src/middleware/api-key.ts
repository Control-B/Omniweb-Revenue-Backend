import { type Request, type Response, type NextFunction } from "express";
import { createHash } from "crypto";
import { db, merchantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyToken } from "../lib/jwt.js";

declare global {
  namespace Express {
    interface Request {
      merchant?: {
        id: string;
        shopId: string;
        email: string;
        plan: string;
      };
    }
  }
}

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

async function resolveFromApiKey(key: string): Promise<Request["merchant"] | null> {
  const hash = hashApiKey(key);
  const rows = await db
    .select({
      id: merchantsTable.id,
      shopId: merchantsTable.shopId,
      email: merchantsTable.email,
      plan: merchantsTable.plan,
    })
    .from(merchantsTable)
    .where(eq(merchantsTable.apiKeyHash, hash))
    .limit(1);
  return rows[0] ?? null;
}

function resolveFromJwt(token: string): Request["merchant"] | null {
  try {
    const payload = verifyToken(token);
    return {
      id: payload.merchantId,
      shopId: payload.shopId,
      email: payload.email,
      plan: "free",
    };
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers["authorization"];
  const apiKey = req.headers["x-widget-api-key"] as string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const merchant = resolveFromJwt(token);
    if (merchant) {
      req.merchant = merchant;
      next();
      return;
    }
  }

  if (apiKey) {
    const merchant = await resolveFromApiKey(apiKey);
    if (merchant) {
      req.merchant = merchant;
      next();
      return;
    }
  }

  res.status(401).json({ error: "Unauthorized", message: "Valid Authorization or x-widget-api-key header required" });
}

export { hashApiKey };
