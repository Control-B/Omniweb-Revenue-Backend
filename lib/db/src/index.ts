import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function readBooleanEnv(name: string): boolean | undefined {
  const rawValue = process.env[name]?.trim().toLowerCase();
  if (!rawValue) {
    return undefined;
  }

  if (["1", "true", "yes", "on"].includes(rawValue)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(rawValue)) {
    return false;
  }

  return undefined;
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function buildPoolConfig(connectionString: string): pg.PoolConfig {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  const explicitVerify = readBooleanEnv("PG_SSL_VERIFY") ?? readBooleanEnv("DATABASE_SSL_VERIFY");
  const isRemoteDatabase = !isLocalHost(url.hostname);

  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslcert");
  url.searchParams.delete("sslkey");
  url.searchParams.delete("sslrootcert");
  url.searchParams.delete("uselibpqcompat");

  const shouldUseSsl =
    sslMode === "require"
    || sslMode === "verify-ca"
    || sslMode === "verify-full"
    || (sslMode == null && isRemoteDatabase);

  const shouldVerifySsl = explicitVerify ?? false;

  return {
    connectionString: url.toString(),
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
