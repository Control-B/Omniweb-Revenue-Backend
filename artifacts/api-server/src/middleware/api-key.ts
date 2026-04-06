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

export function hashApiKey(key: string): string {
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

/**
 * Admin auth: accepts Bearer JWT, HttpOnly session cookie, or x-widget-api-key header.
 * Use for admin endpoints that widgets or external integrations may also call with an API key.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers["authorization"];
  const apiKey = req.headers["x-widget-api-key"] as string | undefined;
  const sessionCookie = (req.cookies as Record<string, string | undefined>)["ow_session"];

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const merchant = resolveFromJwt(token);
    if (merchant) {
      req.merchant = merchant;
      next();
      return;
    }
  }

  if (sessionCookie) {
    const merchant = resolveFromJwt(sessionCookie);
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

  res.status(401).json({ error: "Unauthorized", message: "Valid Authorization, session cookie, or x-widget-api-key header required" });
}

/**
 * Session-only auth: accepts HttpOnly cookie or Bearer JWT — never API keys.
 * Apply to sensitive account-management endpoints (profile, key rotation) where
 * API key possession must not be sufficient to modify account credentials.
 */
export function requireSessionAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const sessionCookie = (req.cookies as Record<string, string | undefined>)["ow_session"];

  if (sessionCookie) {
    const merchant = resolveFromJwt(sessionCookie);
    if (merchant) {
      req.merchant = merchant;
      next();
      return;
    }
  }

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const merchant = resolveFromJwt(token);
    if (merchant) {
      req.merchant = merchant;
      next();
      return;
    }
  }

  res.status(401).json({ error: "Unauthorized", message: "Valid session required" });
}
