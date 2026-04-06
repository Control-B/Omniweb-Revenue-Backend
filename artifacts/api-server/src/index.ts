import app from "./app";
import { logger } from "./lib/logger";
import { checkDatabaseHealth } from "./lib/db-health";
import { seedDemoShop } from "./lib/widget-config-store";

/* In production, SESSION_SECRET must be set to a strong random value.
 * A missing or default secret would allow JWT forgery. */
const sessionSecret = process.env["SESSION_SECRET"];
const isProduction = process.env["NODE_ENV"] === "production";

if (isProduction && (!sessionSecret || sessionSecret === "dev-jwt-secret-not-for-production")) {
  throw new Error(
    "SESSION_SECRET environment variable must be set to a strong, unique value in production.",
  );
}

if (!sessionSecret) {
  logger.warn("SESSION_SECRET not set — using insecure dev fallback. Set SESSION_SECRET before deploying.");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
const host = process.env["HOST"] ?? "0.0.0.0";

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  await checkDatabaseHealth();

  try {
    await seedDemoShop();
    logger.info("Demo shop seeded");
  } catch (err) {
    logger.warn({ err }, "Demo shop seed failed — continuing startup");
  }

  await new Promise<void>((resolve, reject) => {
    app.listen(port, host, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        reject(err);
        return;
      }
      logger.info({ host, port }, "Server listening");
      resolve();
    });
  });
}

start().catch((err: unknown) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
