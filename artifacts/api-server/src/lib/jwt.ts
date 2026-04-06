import jwt from "jsonwebtoken";

export interface JwtPayload {
  merchantId: string;
  shopId: string;
  email: string;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return "dev-jwt-secret-not-for-production";
    }
    throw new Error("SESSION_SECRET environment variable is required");
  }
  return secret;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}
