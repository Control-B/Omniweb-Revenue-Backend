import { Router, type IRouter, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";

const router: IRouter = Router();

const widgetPath = path.join(__dirname, "..", "public", "widget.js");

router.get("/widget.js", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/javascript; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");

  if (!fs.existsSync(widgetPath)) {
    res.status(503).send("// Widget not yet built");
    return;
  }

  res.sendFile(widgetPath);
});

router.options("/widget.js", (_req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.status(204).end();
});

export default router;
