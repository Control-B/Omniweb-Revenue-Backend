import { Router, type IRouter, type Request, type Response } from "express";
import {
  getWidgetConfig,
  getPublicWidgetConfig,
  updateWidgetConfig,
  getAvailableVoices,
} from "../lib/widget-config-store.js";
import { getRecentSessions } from "../lib/session-store.js";

const router: IRouter = Router();

router.get(
  "/widget/:shopId/config",
  async (req: Request<{ shopId: string }>, res: Response): Promise<void> => {
    const shopId = req.params.shopId;
    if (!shopId || typeof shopId !== "string") {
      res.status(400).json({ error: "shopId is required" });
      return;
    }
    try {
      const config = await getPublicWidgetConfig(shopId);
      res.json(config);
    } catch {
      res.status(500).json({ error: "Failed to fetch widget config" });
    }
  }
);

router.get(
  "/widget-config",
  async (req: Request, res: Response): Promise<void> => {
    const shopId = req.merchant!.shopId;
    try {
      const config = await getWidgetConfig(shopId);
      res.json(config);
    } catch {
      res.status(500).json({ error: "Failed to fetch widget config" });
    }
  }
);

router.put(
  "/widget-config",
  async (req: Request, res: Response): Promise<void> => {
    const shopId = req.merchant!.shopId;

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

    try {
      const updated = await updateWidgetConfig(
        shopId,
        updates as Parameters<typeof updateWidgetConfig>[1]
      );
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to update widget config" });
    }
  }
);

router.get("/voices", (_req: Request, res: Response): void => {
  res.json({ voices: getAvailableVoices() });
});

router.get(
  "/conversations",
  async (req: Request, res: Response): Promise<void> => {
    const shopId = req.merchant!.shopId;
    try {
      const limit = Math.min(Number(req.query["limit"] ?? 50), 100);
      const sessions = await getRecentSessions(shopId, limit);
      res.json({ sessions, total: sessions.length });
    } catch {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  }
);

export default router;
