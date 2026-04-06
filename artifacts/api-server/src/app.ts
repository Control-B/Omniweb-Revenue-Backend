import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes/index.js";
import { requireApiKey } from "./middleware/api-key.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

const ALLOWED_ORIGINS = [
  /\.myshopify\.com$/,
  /\.shopify\.com$/,
  /localhost/,
  /127\.0\.0\.1/,
  /\.replit\.dev$/,
  /\.replit\.app$/,
  /\.spock\.replit\.dev$/,
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed = ALLOWED_ORIGINS.some((pattern) => pattern.test(origin));
      if (allowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-widget-api-key"],
    credentials: true,
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
    return body?.shopId ?? req.ip ?? "unknown";
  },
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

app.use("/api/chat", chatLimiter, requireApiKey);
app.use("/api/voice", voiceLimiter, requireApiKey);
app.use("/api/voices-status", requireApiKey);
app.use("/api/widget-config", requireApiKey);
app.use("/api/conversations", requireApiKey);

app.use("/api", router);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

export default app;
