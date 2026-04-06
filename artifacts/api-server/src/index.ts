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

seedDemoShop()
  .then(() => {
    logger.info("Demo shop seeded");
  })
  .catch((err: unknown) => {
    logger.warn({ err }, "Demo shop seed failed — continuing startup");
  });

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
