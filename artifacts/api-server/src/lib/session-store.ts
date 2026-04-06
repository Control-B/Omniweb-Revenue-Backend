import { db, chatSessionsTable, type StoredMessage } from "@workspace/db";
import { eq, desc, lt, sql } from "drizzle-orm";

export type Message = StoredMessage;

export interface Session {
  messages: Message[];
  shopId: string;
  createdAt: Date;
  lastActiveAt: Date;
  messageCount: number;
}

const MAX_SESSIONS = 1000;
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_MESSAGES = 40;
const TRIM_TO = 30;
const PRUNE_INTERVAL_MS = 60 * 1000;

let lastPruneAt = 0;

function tenantKey(shopId: string, sessionId: string): string {
  return `${shopId}::${sessionId}`;
}

async function pruneExpiredSessions(): Promise<void> {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;

  const cutoff = new Date(now - SESSION_TTL_MS);
  await db.delete(chatSessionsTable).where(lt(chatSessionsTable.lastActiveAt, cutoff));

  const allSessions = await db
    .select({ sessionKey: chatSessionsTable.sessionKey })
    .from(chatSessionsTable)
    .orderBy(desc(chatSessionsTable.lastActiveAt));

  if (allSessions.length > MAX_SESSIONS) {
    const toDelete = allSessions.slice(MAX_SESSIONS).map((s) => s.sessionKey);
    for (const key of toDelete) {
      await db.delete(chatSessionsTable).where(eq(chatSessionsTable.sessionKey, key));
    }
  }
}

export async function getOrCreateSession(sessionId: string, shopId: string): Promise<Session> {
  await pruneExpiredSessions();
  const key = tenantKey(shopId, sessionId);
  const now = new Date();

  await db
    .insert(chatSessionsTable)
    .values({
      sessionKey: key,
      sessionId,
      shopId,
      messages: [],
      messageCount: 0,
      firstMessage: "",
      lastActiveAt: now,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: chatSessionsTable.sessionKey,
      set: { lastActiveAt: now },
    });

  const rows = await db
    .select()
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.sessionKey, key))
    .limit(1);

  const row = rows[0]!;
  return {
    messages: (row.messages as Message[]) ?? [],
    shopId: row.shopId,
    createdAt: row.createdAt,
    lastActiveAt: row.lastActiveAt,
    messageCount: row.messageCount,
  };
}

export async function updateSystemMessage(sessionId: string, shopId: string, content: string): Promise<void> {
  const key = tenantKey(shopId, sessionId);
  const rows = await db
    .select({ messages: chatSessionsTable.messages })
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.sessionKey, key))
    .limit(1);

  if (rows.length === 0) return;

  const messages = (rows[0].messages as Message[]) ?? [];
  const sysIdx = messages.findIndex((m) => m.role === "system");
  if (sysIdx >= 0) {
    messages[sysIdx] = { role: "system", content };
  } else {
    messages.unshift({ role: "system", content });
  }

  await db
    .update(chatSessionsTable)
    .set({ messages, lastActiveAt: new Date() })
    .where(eq(chatSessionsTable.sessionKey, key));
}

async function trimMessagesIfNeeded(key: string): Promise<void> {
  const rows = await db
    .select({ messages: chatSessionsTable.messages })
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.sessionKey, key))
    .limit(1);

  if (rows.length === 0) return;
  const messages = (rows[0].messages as Message[]) ?? [];
  if (messages.length <= MAX_MESSAGES) return;

  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");
  const trimmed = [...systemMessages, ...nonSystem.slice(-TRIM_TO)];

  await db
    .update(chatSessionsTable)
    .set({ messages: trimmed })
    .where(eq(chatSessionsTable.sessionKey, key));
}

export async function addMessageToSession(sessionId: string, shopId: string, message: Message): Promise<void> {
  const key = tenantKey(shopId, sessionId);
  const msgJson = JSON.stringify(message);

  const firstMsgUpdate =
    message.role === "user"
      ? sql`CASE WHEN ${chatSessionsTable.firstMessage} = '' THEN ${message.content.slice(0, 200)} ELSE ${chatSessionsTable.firstMessage} END`
      : chatSessionsTable.firstMessage;

  await db
    .update(chatSessionsTable)
    .set({
      messages: sql`${chatSessionsTable.messages} || ${msgJson}::jsonb`,
      messageCount: sql`${chatSessionsTable.messageCount} + 1`,
      firstMessage: firstMsgUpdate,
      lastActiveAt: new Date(),
    })
    .where(eq(chatSessionsTable.sessionKey, key));

  await trimMessagesIfNeeded(key);
}

export async function getRecentSessions(
  shopId: string,
  limit = 50
): Promise<Array<{
  sessionId: string;
  messageCount: number;
  firstMessage: string;
  lastActiveAt: Date;
  createdAt: Date;
}>> {
  const rows = await db
    .select()
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.shopId, shopId))
    .orderBy(desc(chatSessionsTable.lastActiveAt))
    .limit(Math.min(limit, 100));

  return rows.map((row) => ({
    sessionId: row.sessionId,
    messageCount: row.messageCount,
    firstMessage: row.firstMessage,
    lastActiveAt: row.lastActiveAt,
    createdAt: row.createdAt,
  }));
}
