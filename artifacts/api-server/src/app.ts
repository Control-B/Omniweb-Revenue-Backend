import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes/index.js";
import widgetFileRouter from "./routes/widget.js";
import { requireApiKey } from "./middleware/api-key.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

/**
 * CORS strategy
 * ─────────────
 * All API endpoints are secured by the x-widget-api-key header + rate limiting.
 * The widget is embedded on arbitrary merchant storefront domains (custom domains,
 * myshopify.com subdomains, etc.), so we cannot allowlist by origin.
 *
 * Access-Control-Allow-Origin: * is safe here because:
 *  • Every sensitive endpoint requires x-widget-api-key (not a cookie/session)
 *  • credentials: false means cookies are not sent cross-origin
 *  • Rate limiting provides an additional abuse-prevention layer
 */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-widget-api-key"],
    credentials: false,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", message: "Please slow down and try again shortly." },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const body = req.body as { shopId?: string };
    if (body?.shopId) return body.shopId;
    return "unknown";
  },
  validate: { keyGeneratorIpFallback: false },
  message: { error: "Chat rate limit exceeded", message: "Too many messages. Please wait a moment." },
});

const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Voice rate limit exceeded", message: "Too many voice requests. Please wait a moment." },
});

app.use(globalLimiter);

/* Widget static file — public, no API key required, CORS set in route handler */
app.use(widgetFileRouter);

/* Widget API surface — API key auth + per-endpoint rate limiting */
app.use("/api/chat", chatLimiter, requireApiKey);
app.use("/api/voice", voiceLimiter, requireApiKey);
app.use("/api/voices", requireApiKey);
app.use("/api/voices-status", requireApiKey);
app.use("/api/widget-config", requireApiKey);
app.use("/api/conversations", requireApiKey);

app.use("/api", router);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

export default app;
