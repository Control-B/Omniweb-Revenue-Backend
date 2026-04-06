import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes/index.js";
import widgetFileRouter from "./routes/widget.js";
import { requireAuth } from "./middleware/api-key.js";
import { logger } from "./lib/logger.js";

const app: Express = express();
app.set("trust proxy", 1);

/**
 * CORS strategy
 * ─────────────
 * Public widget endpoints (chat, voice, widget config) are accessed from any
 * storefront domain, so we use Access-Control-Allow-Origin: *.
 * Admin endpoints require Authorization: Bearer or x-widget-api-key.
 * credentials: false means cookies are never sent cross-origin.
 */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-widget-api-key", "Authorization"],
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
    const body = req.body as { shopId?: string; sessionId?: string };
    const shopId = body?.shopId ?? "unknown";
    const sessionId = body?.sessionId ?? "anon";
    return `${shopId}::${sessionId}`;
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

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts", message: "Please wait a minute before trying again." },
});

/* Widget static file served BEFORE global rate limiter — public CDN-like asset */
app.use(widgetFileRouter);

app.use(globalLimiter);

/* Public widget endpoints — rate limited, no auth required */
app.use("/api/chat", chatLimiter);
app.use("/api/voice", voiceLimiter);

/* Auth endpoints — rate limited, no auth required */
app.use("/api/auth", authLimiter);

/* Admin-only endpoints — require JWT or API key (sets req.merchant) */
app.use("/api/voices", requireAuth);
app.use("/api/voices-status", requireAuth);
app.use("/api/widget-config", requireAuth);
app.use("/api/conversations", requireAuth);

app.use("/api", router);

app.get("/preview", (req: Request, res: Response) => {
  const shopId = (req.query.shopId as string | undefined) ?? "demo.myshopify.com";
  const apiUrl = `${req.protocol}://${req.get("host")}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Widget Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           background: #f4f4f5; color: #111; min-height: 100vh; }
    .nav { background: #fff; border-bottom: 1px solid #e5e7eb;
           padding: 14px 24px; display: flex; align-items: center; gap: 24px; }
    .nav-brand { font-weight: 700; font-size: 18px; }
    .nav-link { font-size: 14px; color: #6b7280; }
    .hero { background: #fff; padding: 48px 24px; text-align: center; border-bottom: 1px solid #e5e7eb; }
    .hero h1 { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
    .hero p { color: #6b7280; font-size: 15px; margin-bottom: 24px; }
    .hero-btn { background: #111; color: #fff; border: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; cursor: default; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 24px; max-width: 960px; margin: 0 auto; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
    .card-img { width: 100%; aspect-ratio: 4/3; background: #e5e7eb; }
    .card-body { padding: 12px; }
    .card-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
    .card-price { color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <nav class="nav">
    <span class="nav-brand">My Shopify Store</span>
    <span class="nav-link">Collections</span>
    <span class="nav-link">Products</span>
    <span class="nav-link">About</span>
  </nav>
  <section class="hero">
    <h1>Summer Collection 2025</h1>
    <p>Discover our latest arrivals — handcrafted with care.</p>
    <button class="hero-btn">Shop Now</button>
  </section>
  <div class="grid">
    ${["Premium Hoodie", "Classic Tee", "Cargo Pants", "Canvas Tote", "Snapback Cap", "Denim Jacket"]
      .map((name, i) => `<div class="card"><div class="card-img" style="background:hsl(${i * 60},15%,88%)"></div><div class="card-body"><div class="card-title">${name}</div><div class="card-price">$${(29 + i * 15).toFixed(2)}</div></div></div>`)
      .join("")}
  </div>
  <script src="${apiUrl}/widget.js"
    data-api-url="${apiUrl}"
    data-shop-id="${shopId}"
    defer></script>
</body>
</html>`);
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

export default app;
