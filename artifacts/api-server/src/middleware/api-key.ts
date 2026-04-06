import { type Request, type Response, type NextFunction } from "express";

const isDev = process.env.NODE_ENV !== "production";

function getWidgetApiKey(): string | undefined {
  const key = process.env.WIDGET_API_KEY;
  if (!key) {
    if (isDev) {
      return "dev-widget-key";
    }
    return undefined;
  }
  return key;
}

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const expectedKey = getWidgetApiKey();

  if (!expectedKey) {
    res
      .status(503)
      .json({ error: "Service misconfigured", message: "WIDGET_API_KEY environment variable is not set." });
    return;
  }

  const provided =
    (req.headers["x-widget-api-key"] as string | undefined) ??
    (req.query["apiKey"] as string | undefined);

  if (!provided || provided !== expectedKey) {
    res.status(401).json({ error: "Unauthorized", message: "Valid API key required" });
    return;
  }

  next();
}
