# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Shopify Storefront Integration

This repo ships the standalone Omniweb app backend, merchant dashboard, and embeddable widget.

- Merchants integrate the widget into their existing Shopify theme
- Installation instructions live in `artifacts/dashboard/src/pages/install.tsx`
- The storefront snippet/theme code can live in a separate theme repository

## Merchant Auth System

Merchants sign up with email + shopId + password. Passwords hashed with bcryptjs (12 rounds). API keys use format `ow_live_<48 hex chars>`, stored as SHA-256 hash.

**Auth endpoints (rate-limited to 10 req/min):**
| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/auth/signup` | None | Create account → returns JWT + API key (shown once) |
| `POST /api/auth/login` | None | Email + password → returns 7-day JWT |
| `GET /api/auth/me` | Bearer JWT | Returns merchant profile + apiKeyPrefix |
| `POST /api/auth/rotate-key` | Bearer JWT | Generate new API key, old key invalidated immediately |

**Admin endpoints** (`/api/widget-config`, `/api/conversations`, `/api/voices`) require either:
- `Authorization: Bearer <jwt>` (dashboard sessions)
- `x-widget-api-key: <key>` (widget-to-backend calls)

**Key files:**
- `artifacts/api-server/src/middleware/api-key.ts` — `requireAuth` middleware (JWT or API key)
- `artifacts/api-server/src/lib/jwt.ts` — 7-day JWT sign/verify (uses SESSION_SECRET env var)
- `artifacts/api-server/src/routes/auth.ts` — signup/login/me/rotate-key endpoints

**Dashboard auth flow (cookie-based):**
- Auth uses HttpOnly `ow_session` cookie (set server-side on login/signup, cleared on logout)
- No JWT or token is ever stored in client-side JS storage
- On app load, `use-auth.tsx` calls `GET /api/auth/me` to validate cookie and hydrate auth state
- Only display metadata (shopId, email) is held in React state for the current session
- Signup → shows API key once → "Continue to Dashboard" → `/settings`
- Pages: Login (`/`), Signup (`/signup`), API Keys (`/api-keys`)

## AI Sales Widget Backend

The API server (`artifacts/api-server/`) is extended with these endpoints:

| Endpoint | Description |
|----------|-------------|
| `POST /api/chat` | AI chat — accepts `{ sessionId, message, shopId, pageContext }`, returns AI reply |
| `POST /api/voice` | ElevenLabs TTS — accepts `{ text, voiceId }`, streams audio (requires `ELEVENLABS_API_KEY`) |
| `GET /api/widget/:shopId/config` | Public widget settings (no auth, for the embeddable widget) |
| `GET/PUT /api/widget-config` | Admin widget settings (requires auth, uses req.merchant.shopId) |
| `GET /api/voices` | Available ElevenLabs voice list (requires auth) |
| `GET /api/conversations` | Recent chat sessions (requires auth, uses req.merchant.shopId) |

**Key files:**
- `artifacts/api-server/src/lib/session-store.ts` — DB-backed conversation history (async, PostgreSQL via Drizzle)
- `artifacts/api-server/src/lib/widget-config-store.ts` — DB-backed per-shop widget config (async upsert, auto-seeds demo shop)
- `artifacts/api-server/src/routes/chat.ts` — OpenAI chat endpoint with `buildSystemPrompt` + `formatPageContext`
- `artifacts/api-server/src/routes/voice.ts` — ElevenLabs voice endpoint (stub if no key)
- `artifacts/api-server/src/routes/widget-config.ts` — config + conversations endpoints
- `artifacts/api-server/src/routes/widget.ts` — serves `dist/widget.js` (open CORS, no auth)

## Embeddable Widget

- `artifacts/api-server/src/widget/omniweb-widget.js` — browser IIFE source (~11kb minified)
- Bundled via esbuild (`platform: browser, format: iife`) → `dist/widget.js`
- Shadow DOM UI, sessionStorage session ID, voice playback (Web Audio API), mute toggle
- Merchant install: one `<script>` tag with `data-api-url`, `data-api-key`, `data-shop-id`
- Reads `window.__owContext` on every message send for live page context

## Shopify Product Context Integration

- Merchants can add a Liquid snippet to their existing theme that:
  1. Writes `window.__owContext` with product/collection/cart data from Liquid globals
  2. Loads the Omniweb widget `<script>`
- The dashboard install page provides the copy-paste snippet merchants need
- Chat backend (`/api/chat`) formats `pageContext` into a structured system-prompt block
- Context is updated on every message, so AI stays current when the shopper navigates
- No Admin API needed — all data comes from Shopify storefront Liquid globals

**Env vars needed:**
- `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` — set automatically via Omniweb AI integrations
- `ELEVENLABS_API_KEY` — add when ready to enable voice (user to provide)
- `WIDGET_API_KEY` — optional; defaults to `dev-widget-key` in dev

**Note:** ElevenLabs integration was intentionally deferred. Voice endpoint returns clear 503 until `ELEVENLABS_API_KEY` is set.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
