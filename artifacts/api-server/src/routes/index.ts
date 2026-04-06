import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import chatRouter from "./chat.js";
import voiceRouter from "./voice.js";
import widgetConfigRouter from "./widget-config.js";
import authRouter from "./auth.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(chatRouter);
router.use(voiceRouter);
router.use(widgetConfigRouter);

export default router;
