import { Router, type IRouter, type Request, type Response } from "express";
import {
  getWidgetConfig,
  updateWidgetConfig,
  getAvailableVoices,
} from "../lib/widget-config-store.js";
import { getRecentSessions } from "../lib/session-store.js";

const router: IRouter = Router();

router.get(
  "/widget-config/:shopId",
  (req: Request<{ shopId: string }>, res: Response): void => {
    const shopId = req.params.shopId;
    if (!shopId || typeof shopId !== "string") {
      res.status(400).json({ error: "shopId is required" });
      return;
    }
    const config = getWidgetConfig(shopId);
    res.json(config);
  }
);

router.put(
  "/widget-config/:shopId",
  (req: Request<{ shopId: string }>, res: Response): void => {
    const shopId = req.params.shopId;
    if (!shopId || typeof shopId !== "string") {
      res.status(400).json({ error: "shopId is required" });
      return;
    }

    const allowed = [
      "greeting",
      "persona",
      "voiceId",
      "accentColor",
      "position",
      "widgetTitle",
      "enabled",
    ] as const;

    const updates: Partial<Record<(typeof allowed)[number], unknown>> = {};
    for (const key of allowed) {
      if (key in req.body) {
        updates[key] = (req.body as Record<string, unknown>)[key];
      }
    }

    const updated = updateWidgetConfig(
      shopId,
      updates as Parameters<typeof updateWidgetConfig>[1]
    );
    res.json(updated);
  }
);

router.get("/voices", (_req: Request, res: Response): void => {
  res.json({ voices: getAvailableVoices() });
});

router.get(
  "/conversations/:shopId",
  (req: Request<{ shopId: string }>, res: Response): void => {
    const shopId = req.params.shopId;
    if (!shopId || typeof shopId !== "string") {
      res.status(400).json({ error: "shopId is required" });
      return;
    }
    const limit = Math.min(Number(req.query["limit"] ?? 50), 100);
    const sessions = getRecentSessions(shopId, limit);
    res.json({ sessions, total: sessions.length });
  }
);

export default router;
