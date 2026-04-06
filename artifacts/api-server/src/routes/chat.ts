import { Router, type IRouter, type Request, type Response } from "express";
import OpenAI from "openai";
import {
  getOrCreateSession,
  addMessageToSession,
  type Message,
} from "../lib/session-store.js";
import { getWidgetConfig } from "../lib/widget-config-store.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function getOpenAIClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "placeholder";
  return new OpenAI({ baseURL, apiKey });
}

router.post("/chat", async (req: Request, res: Response): Promise<void> => {
  const { sessionId, message, shopId, pageContext } = req.body as {
    sessionId?: string;
    message?: string;
    shopId?: string;
    pageContext?: Record<string, unknown>;
  };

  if (!sessionId || typeof sessionId !== "string") {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const shop = (shopId ?? "default").slice(0, 100);
  const config = getWidgetConfig(shop);
  const session = getOrCreateSession(sessionId, shop);

  if (session.messages.length === 0) {
    let systemPrompt = config.persona;
    if (pageContext) {
      systemPrompt += `\n\nCurrent page context:\n${JSON.stringify(pageContext, null, 2)}`;
    }
    const systemMsg: Message = { role: "system", content: systemPrompt };
    addMessageToSession(sessionId, shop, systemMsg);
  }

  const userMsg: Message = { role: "user", content: message.trim() };
  addMessageToSession(sessionId, shop, userMsg);

  const openai = getOpenAIClient();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: session.messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 512,
    });

    const reply =
      completion.choices[0]?.message?.content ?? "Sorry, I couldn't generate a reply.";
    const assistantMsg: Message = { role: "assistant", content: reply };
    addMessageToSession(sessionId, shop, assistantMsg);

    res.json({
      reply,
      sessionId,
      messageCount: session.messageCount,
    });
  } catch (err) {
    logger.error({ err }, "OpenAI chat error");
    res.status(502).json({
      error: "AI service unavailable",
      message: "Unable to get a response. Please try again.",
    });
  }
});

export default router;
