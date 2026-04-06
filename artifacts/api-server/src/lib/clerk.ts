import { createClerkClient, verifyToken } from "@clerk/backend";

const secretKey = process.env["CLERK_SECRET_KEY"];
const publishableKey = process.env["CLERK_PUBLISHABLE_KEY"];

export function isClerkConfigured(): boolean {
  return Boolean(secretKey && publishableKey);
}

export function getClerkClient() {
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY environment variable is required");
  }

  return createClerkClient({
    secretKey,
    publishableKey,
  });
}

export async function verifyClerkSessionToken(token: string): Promise<{ clerkUserId: string } | null> {
  if (!secretKey) {
    return null;
  }

  try {
    const payload = await verifyToken(token, { secretKey });
    const subject = typeof payload.sub === "string" ? payload.sub : null;
    if (!subject) {
      return null;
    }

    return { clerkUserId: subject };
  } catch {
    return null;
  }
}