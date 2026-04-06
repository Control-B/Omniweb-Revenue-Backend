import jwt from "jsonwebtoken";

export interface JwtPayload {
  merchantId: string;
  shopId: string;
  email: string;
}

function readSessionSecret(): string | undefined {
  return process.env.SESSION_SECRET ?? process.env.session_secret;
}

function getSecret(): string {
  const secret = readSessionSecret();
  if (!secret) {
    return "dev-jwt-secret-not-for-production";
  }
  return secret;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}
