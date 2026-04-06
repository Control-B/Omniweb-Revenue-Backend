import app from "./app";
import { logger } from "./lib/logger";
import { seedDemoShop } from "./lib/widget-config-store";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  try {
    await seedDemoShop();
    logger.info("Demo shop seeded");
  } catch (err) {
    logger.warn({ err }, "Demo shop seed failed — continuing startup");
  }

  await new Promise<void>((resolve, reject) => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        reject(err);
        return;
      }
      logger.info({ port }, "Server listening");
      resolve();
    });
  });
}

start().catch((err: unknown) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
