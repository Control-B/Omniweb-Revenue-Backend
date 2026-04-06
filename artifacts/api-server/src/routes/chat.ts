import { Router, type IRouter, type Request, type Response } from "express";
import OpenAI from "openai";
import {
  getOrCreateSession,
  addMessageToSession,
  updateSystemMessage,
  type Message,
} from "../lib/session-store.js";
import { getWidgetConfig } from "../lib/widget-config-store.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function getOpenAIClient(): OpenAI | null {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    return null;
  }
  return new OpenAI({ baseURL, apiKey });
}

/**
 * Format a pageContext object into a clear, structured text block that the AI
 * can use to answer product questions accurately. Returns an empty string if
 * no meaningful context is present.
 */
function formatPageContext(ctx: Record<string, unknown>): string {
  if (!ctx || typeof ctx !== "object") return "";

  const lines: string[] = [];
  const pageType = (ctx.pageType as string) || "unknown";
  const shopName = ctx.shopName as string | undefined;
  const currency = (ctx.currency as string) || "";

  if (shopName) lines.push(`Store: ${shopName}`);
  lines.push(`Page Type: ${pageType}`);
  if (ctx.pageUrl) lines.push(`Page URL: ${ctx.pageUrl}`);

  if (pageType === "product" && ctx.product && typeof ctx.product === "object") {
    const p = ctx.product as Record<string, unknown>;
    const currentHandle = p.handle as string | undefined;

    lines.push("");
    lines.push("## Product Being Viewed");
    if (p.title)          lines.push(`Name: ${p.title}`);
    if (p.vendor)         lines.push(`Brand: ${p.vendor}`);
    if (p.type)           lines.push(`Category: ${p.type}`);
    if (p.price)          lines.push(`Price: ${p.price} ${currency}`.trim());
    if (p.compareAtPrice) lines.push(`Original Price: ${p.compareAtPrice} ${currency}`.trim());
    if (p.available !== undefined) lines.push(`In Stock: ${p.available ? "Yes" : "No — currently sold out"}`);
    if (p.description)    lines.push(`Description: ${p.description}`);

    const variants = p.variantDetails as Array<Record<string, unknown>> | undefined;
    if (variants && variants.length > 0) {
      lines.push(`\nVariants (${variants.length} total):`);
      variants.slice(0, 12).forEach((v) => {
        const avail = v.available ? "available" : "sold out";
        const sku   = v.sku ? ` — SKU: ${v.sku}` : "";
        lines.push(`  • ${v.title}: ${v.price} ${currency} (${avail})${sku}`.trim());
      });
    }

    if (p.tags && Array.isArray(p.tags) && (p.tags as unknown[]).length > 0) {
      lines.push(`Tags: ${(p.tags as string[]).join(", ")}`);
    }
    if (ctx.collectionTitle) lines.push(`Collection: ${ctx.collectionTitle}`);

    /* Related products from the same collection — excludes the product being viewed */
    const collectionProducts = ctx.collectionProducts as Array<Record<string, unknown>> | undefined;
    if (collectionProducts && collectionProducts.length > 0) {
      const related = collectionProducts.filter(
        (cp) => !currentHandle || cp.handle !== currentHandle,
      );
      if (related.length > 0) {
        const collName = (ctx.collectionTitle as string) || "the same collection";
        lines.push(`\n## Related Products from ${collName}`);
        lines.push("(You can recommend these as alternatives or complementary items)");
        related.slice(0, 8).forEach((rp) => {
          const avail = rp.available ? "in stock" : "sold out";
          lines.push(`  • ${rp.title}: ${rp.price} ${currency} (${avail}) — ${rp.url}`.trim());
        });
      }
    }
  }

  if (pageType === "collection" && ctx.collection && typeof ctx.collection === "object") {
    const c = ctx.collection as Record<string, unknown>;
    lines.push("");
    lines.push("## Collection Being Viewed");
    if (c.title)          lines.push(`Name: ${c.title}`);
    if (c.description)    lines.push(`Description: ${c.description}`);
    if (c.productsCount)  lines.push(`Total products: ${c.productsCount}`);

    const products = c.products as Array<Record<string, unknown>> | undefined;
    if (products && products.length > 0) {
      lines.push(`\nProducts in collection (showing ${products.length}):`);
      products.forEach((p) => {
        const avail = p.available ? "" : " — sold out";
        lines.push(`  • ${p.title}: ${p.price} ${currency}${avail}`.trim());
      });
    }
  }

  if (pageType === "cart" && ctx.cart && typeof ctx.cart === "object") {
    const cart = ctx.cart as Record<string, unknown>;
    lines.push("");
    lines.push("## Shopper's Current Cart");
    if (cart.itemCount)  lines.push(`Items: ${cart.itemCount}`);
    if (cart.totalPrice) lines.push(`Total: ${cart.totalPrice}`);

    const items = cart.items as Array<Record<string, unknown>> | undefined;
    if (items && items.length > 0) {
      lines.push("Cart contents:");
      items.forEach((item) => {
        const variant = item.variantTitle && item.variantTitle !== "Default Title"
          ? ` (${item.variantTitle})` : "";
        lines.push(`  • ${item.title}${variant} ×${item.quantity} — ${item.linePrice}`);
      });
    }
  }

  if (pageType === "search") {
    if (ctx.searchTerm)        lines.push(`\nSearch Term: ${ctx.searchTerm}`);
    if (ctx.searchResultCount) lines.push(`Results Found: ${ctx.searchResultCount}`);
  }

  return lines.join("\n");
}

/**
 * Build the full system prompt: persona + formatted page context.
 * This is rebuilt on every request so the AI always sees the current page.
 */
function buildSystemPrompt(persona: string, pageContext?: Record<string, unknown>): string {
  if (!pageContext) return persona;
  const contextBlock = formatPageContext(pageContext);
  if (!contextBlock) return persona;
  return [
    persona,
    "",
    "---",
    "**Current Store Page Context** (use this to give accurate, relevant answers):",
    contextBlock,
    "",
    "Always use the above context when answering questions about products, prices, availability, or the cart. Do not ask the shopper for information you already have from the context.",
  ].join("\n");
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
  if (!shopId || typeof shopId !== "string") {
    res.status(400).json({ error: "shopId is required" });
    return;
  }

  const shop = shopId.slice(0, 200);
  const config = getWidgetConfig(shop);
  const session = getOrCreateSession(sessionId, shop);

  /* Build system prompt with the latest page context from the current request.
     Updating on every message (not just the first) ensures the AI gets
     fresh product/collection data if the shopper navigates between pages. */
  const systemContent = buildSystemPrompt(config.persona, pageContext || undefined);

  if (session.messages.length === 0) {
    const systemMsg: Message = { role: "system", content: systemContent };
    addMessageToSession(sessionId, shop, systemMsg);
  } else {
    updateSystemMessage(sessionId, shop, systemContent);
  }

  const userMsg: Message = { role: "user", content: message.trim() };
  addMessageToSession(sessionId, shop, userMsg);

  const openai = getOpenAIClient();
  if (!openai) {
    res.status(503).json({
      error: "AI service not configured",
      message:
        "OpenAI integration is not set up. AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY must be set.",
    });
    return;
  }

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
