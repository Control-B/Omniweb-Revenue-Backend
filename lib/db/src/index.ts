import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function buildPoolConfig(connectionString: string): pg.PoolConfig {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  const isRemoteDatabase = !isLocalHost(url.hostname);

  const shouldUseSsl =
    sslMode === "require"
    || sslMode === "verify-ca"
    || sslMode === "verify-full"
    || (sslMode == null && isRemoteDatabase);

  const shouldVerifySsl = sslMode === "verify-ca" || sslMode === "verify-full";

  return {
    connectionString,
    ssl: shouldUseSsl
      ? {
          rejectUnauthorized: shouldVerifySsl,
        }
      : undefined,
  };
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool(buildPoolConfig(process.env.DATABASE_URL));
export const db = drizzle(pool, { schema });

export * from "./schema";
