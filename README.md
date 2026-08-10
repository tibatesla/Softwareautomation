# Chestone Properties CRM

[![GitHub Repo](https://img.shields.io/badge/GitHub-Chestone-181717?logo=github)](https://github.com/tibatesla/Chestone)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

A self-hosted real-estate CRM and ad-performance platform for Chestone Properties Ltd (Nairobi, Kenya). It captures leads from WhatsApp, manages properties/bookings/payments across Owner/Admin/Agent roles, and ingests ad performance from Meta, Google, and TikTok with a rule-based + AI-assisted optimization layer.

This document describes what the code **actually does today**, based on the current state of [src/](src/) and [web/](web/). It is not a proposal — everything below is built, deployed, and verified against a live database.

## Architecture

Two deployable apps, one shared PostgreSQL database:

- **Backend** ([src/](src/)) — Express + TypeScript REST API. Prisma is used only as a typed query layer over hand-written SQL migrations, not as the schema's source of truth: every table and Row-Level Security (RLS) policy is defined in [src/db/migrations/](src/db/migrations/), and `prisma/schema.prisma` is *generated* from the live database (`prisma db pull`), not hand-authored.
- **Frontend** ([web/](web/)) — Next.js 16 App Router. The browser never talks to the Express API directly: every request goes through a Next.js Route Handler acting as a BFF (backend-for-frontend) at `web/app/api/backend/[...path]/route.ts`, which attaches the server-side JWT and forwards to the Express API. Auth cookies (`chestone_session` httpOnly JWT, `chestone_user` for client-side role checks) are set by `web/app/api/auth/login/route.ts`.
- **Access control is enforced at the database layer, not just in application code.** Every table has Postgres Row-Level Security policies keyed off two session variables (`app.current_role`, `app.current_user_id`) set per-request via `withRLSContext()` ([src/config/database.ts](src/config/database.ts)). Background jobs (cron, the WhatsApp webhook) run under a separate `withSystemContext()` using a `'system'` role with its own narrower policies — there is no way for application code to bypass RLS by mistake, since even a compromised/bugged request handler is still bound by whatever role it authenticated as.

```text
Browser (Next.js pages)
  -> Next.js Route Handler (BFF, attaches JWT server-side)
  -> Express API (RLS-scoped Prisma queries)
  -> PostgreSQL (RLS policies enforce Owner/Admin/Agent data boundaries)
```

## Technology stack

- Runtime: Node.js 20, TypeScript
- Backend: Express 5, Prisma Client (typed queries only — see above), Zod validation
- Frontend: Next.js 16 (App Router, Turbopack), React 19, TanStack Query, Tailwind CSS, shadcn/ui (Base UI primitives, not Radix)
- Database: self-hosted PostgreSQL 16 (Docker), Row-Level Security throughout
- Queue: BullMQ + Redis (ad-optimization rule engine)
- Media storage: Cloudinary (property photos/videos)
- Messaging: Meta WhatsApp Business Cloud API (direct integration, no third-party BSP)
- AI: Groq (`llama-3.3-70b-versatile`) primary, self-hosted Ollama (`llama3.2:1b`) as a fallback for the ad-performance advisor specifically — see [AI reasoning layer](#ai-reasoning-layer)
- Process management: pm2 (backend + frontend), Nginx reverse proxy, Let's Encrypt/certbot for TLS

## Project structure

```text
src/
  app.ts                          # Express app: middleware, health check, route mounting
  server.ts                       # Boot sequence: DNS order, cron init, worker init, graceful shutdown
  config/
    database.ts                  # Prisma client, withRLSContext / withSystemContext
  controllers/                    # One file per resource (property, lead, booking, payment, user, whatsapp, ad-performance, auth)
  cron/
    ad-performance-ingestion.cron.ts  # Hourly: pulls spend/impressions/clicks from Meta/Google/TikTok
    token-refresh.cron.ts             # Refreshes rotatable OAuth tokens before they expire
  db/
    migrate.ts                   # Runs all migrations in order, tracked in schema_migrations
    migrations/                  # 001_bootstrap.sql .. 020_lead_messages_sender_type.sql
  middlewares/                   # JWT auth, RBAC, upload (multer), WhatsApp webhook HMAC verification
  queues/
    ad-action.queue.ts           # BullMQ queue for rule-engine-triggered ad actions (pause/throttle/budget change)
  routes/                        # Express routers, one per resource
  schemas/                       # Zod validation schemas, one per resource
  services/
    ad-platforms/                # Meta/Google/TikTok Marketing API clients (shared AdPlatformClient interface)
    ad-rule-engine.service.ts    # Deterministic CPA/ROAS/CPL threshold engine
    ad-ai-advisor.service.ts     # AI-generated plain-language recommendations on top of the rule engine
    ai-provider.service.ts       # Shared Groq-primary/Ollama-fallback chat completion layer
    auth.service.ts              # JWT issuance, password hashing (bcrypt)
    cloudinary.service.ts        # Property media upload/delete
    lead-qualification.service.ts # WhatsApp bot: deterministic state machine, captures 5 qualification fields
    lead-ai-assistant.service.ts # AI-phrased WhatsApp replies, strict Chestone-only topic guardrail
    meta-capi.service.ts         # Fires a Conversions API event when a lead qualifies (ad attribution)
    system-secrets.service.ts    # Fail-closed rotatable secret resolution (system_secrets table)
    tracking.service.ts          # Phone normalization
    whatsapp-cloud-api.service.ts # Meta WhatsApp Business Cloud API client (send)
  workers/
    ad-action.worker.ts          # Consumes ad-action.queue.ts, executes rule engine decisions via ad platform APIs
web/
  app/
    (app)/                       # Authenticated pages: dashboard, properties, leads, bookings, payments, users, ad-performance
    api/
      auth/                      # login/logout Route Handlers (sets/clears session cookies)
      backend/[...path]/         # Generic BFF proxy to the Express API
      backend/properties/[id]/media/  # Dedicated multipart proxy for property media upload
    login/                       # Public login page
  components/                    # Feature components (properties, leads, bookings, payments, users) + shadcn/ui primitives
  lib/
    queries/                     # TanStack Query hooks, one per resource
    types.ts, api.ts, session.ts, status-colors.ts
  proxy.ts                       # Next.js 16 middleware (renamed from middleware.ts) — route protection
deploy/
  backup-postgres.sh             # Daily pg_dump + gzip + retention pruning
  chestone-db-backup.service     # systemd oneshot unit
  chestone-db-backup.timer       # systemd timer, daily 02:00 UTC
```

## Modules

- **Auth & Access Control** — custom JWT auth (no third-party auth provider), Owner/Admin/Agent roles enforced via Postgres RLS on every table. An Agent can never read or modify another Agent's assigned properties, payments, bookings, or leads, even if the API layer had a bug — the database itself refuses the query.
- **Backend API** — full CRUD for properties, payments (append-only ledger, Owner can correct entries), bookings/calendar, leads, and user management (Owner/Admin only, cannot create/promote another Owner).
- **WhatsApp Lead Capture** — direct Meta WhatsApp Business Cloud API integration (not a third-party BSP). Inbound webhook verified with real HMAC-SHA256 signatures (`X-Hub-Signature-256`), not just a URL secret. New leads are auto-created from first contact; a scripted state machine asks one question at a time until 5 qualification fields are filled (name, property interest, investment type, budget, transaction type), then the lead becomes visible in the Agent claim queue. Full message history (both directions) is persisted per lead and viewable on the lead detail page. An Agent who has claimed a lead (or Owner/Admin regardless of claim) can also reply manually from the CRM — the bot automatically defers to a human who has replied within the last 5 minutes, so it never talks over an active conversation, but resumes helping on a lead's later follow-up (e.g. from a new ad click) if no one has responded recently.
- **AI-Assisted Ad Optimization** — ingests hourly spend/impressions/clicks per creative from Meta, Google, and TikTok Ads. A deterministic rule engine computes CPA/ROAS/CPL and flags/throttles underperforming creatives. An AI advisory layer (Groq, with a self-hosted Ollama fallback) generates a plain-language recommendation on top of the rule engine's decision — advisory only, never executes actions itself.
- **Media Management** — manual property photo/video upload via Cloudinary, linked to the property record.
- **Agent / Admin / Owner Portals** — three role-scoped frontends covering the full workflow: claim a lead, book a visit, log a payment (Agent); property CRUD, agent assignment, cross-agent visibility (Admin); portfolio-wide totals, ad performance dashboard, user management (Owner).

## Database

Schema and RLS policies live entirely in [src/db/migrations/](src/db/migrations/) as plain SQL, applied in order and tracked in a `schema_migrations` table. There is no Prisma-managed migration history — `npm run migrate` runs pending SQL files, then regenerates `prisma/schema.prisma` by introspecting the resulting database (`prisma db pull`). To add a schema change: write a new numbered migration file, then run `npm run migrate`.

Automated daily backups run via a systemd timer (`deploy/chestone-db-backup.timer`) at 02:00 UTC — `pg_dump`, gzipped, 14-day local retention, logged to `~/backups/postgres/backup.log` on the VPS.

## AI reasoning layer

Two independent uses, sharing `src/services/ai-provider.service.ts`:

1. **Ad-performance advisor** — Groq primary, self-hosted Ollama (`llama3.2:1b`, CPU-only on the VPS) as a real fallback if Groq is unavailable. Verified live: breaking the Groq key still produces a coherent, data-grounded recommendation via Ollama.
2. **WhatsApp bot reply guardrail** — Groq only. Ollama was tested against this specific prompt (a longer, multi-rule system prompt: stay on-topic, never fabricate listings/pricing, never invent a lead's name, resist prompt injection, always ask the next qualification question) and found unreliable at this VPS's hardware limits (2 vCPU, no GPU) — it held the topic restriction but dropped the "always ask the next question" instruction in 2 of 3 test cases. A dropped instruction stalls the qualification flow, which is worse than the plain scripted question this already falls back to, so this path intentionally stays Groq-only with a canned-text fallback.

## Environment variables

```env
# Core
PORT=4000
NODE_ENV=production
DATABASE_URL=postgresql://app_user:...@localhost:55432/chestone
MIGRATIONS_DATABASE_URL=postgresql://<superuser>:...@localhost:55432/chestone  # migrations need elevated privileges (CREATE POLICY, etc.)
REDIS_URL=redis://localhost:56379

# Auth
JWT_SECRET=
JWT_EXPIRES_IN=8h

# WhatsApp (Meta Business Cloud API, direct)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_SECRET=            # URL path secret + hub.verify_token
# META_WHATSAPP_ACCESS_TOKEN is NOT an env var -- stored in system_secrets (provider='meta'), rotatable

# Meta Marketing API + Conversions API
META_APP_ID=
META_APP_SECRET=
META_AD_ACCOUNT_ID=
META_DATASET_ID=                    # Conversions API only
META_PAGE_ID=                       # Conversions API only

# Google Ads API
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
# GOOGLE_ADS_REFRESH_TOKEN is NOT an env var -- stored in system_secrets (provider='google'), rotatable

# TikTok Marketing API
TIKTOK_ADS_ADVERTISER_ID=
# TIKTOK_ADS_ACCESS_TOKEN is NOT an env var -- stored in system_secrets (provider='tiktok'), rotatable

# Cloudinary (property media)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# AI reasoning layer
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
# OLLAMA_API_URL=http://127.0.0.1:11434/api/chat   # defaults shown; only needed to override
# OLLAMA_MODEL=llama3.2:1b
```

Rotatable third-party API tokens (Meta Marketing API, Google Ads refresh token, TikTok access token, WhatsApp Cloud API access token) are deliberately **not** environment variables — they live in the `system_secrets` table and are resolved fail-closed via `resolveActiveSecret()` ([src/services/system-secrets.service.ts](src/services/system-secrets.service.ts)): a missing or expired secret throws and halts the affected operation rather than silently degrading. Seed them with `upsertSecret(provider, keyName, value, expiresAt?)`.

`web/.env.local` (Next.js) needs only:

```env
BACKEND_URL=http://localhost:4000
```

## Local development

### Prerequisites

- Node.js 20+, npm
- Docker (Postgres + Redis via `docker-compose.yml`)

### Setup

```bash
npm install
cd web && npm install && cd ..
docker compose up -d chestone-postgres chestone-redis
cp .env.example .env   # fill in real values
npm run migrate
npm run dev             # backend, port 4000
cd web && npm run dev   # frontend, port 3100
```

### Scripts

Backend: `npm run dev` (nodemon), `npm run build` (tsc), `npm start` (compiled), `npm run migrate` (apply pending SQL migrations + regenerate Prisma client).

Frontend (`web/`): `npm run dev`, `npm run build`, `npm start`, `npm run lint`.

## Production deployment

Runs on a single Azure VM: Postgres + Redis in Docker, backend and frontend under pm2, Nginx reverse-proxying `crm.chestoneproperties.com` with a Let's Encrypt certificate (auto-renewing via a systemd timer). `/api/webhooks/` is proxied directly to the Express backend (port 4000); everything else goes to the Next.js frontend (port 3000).

```bash
# Backend
npm run build && npm run migrate
pm2 start dist/server.js --name chestone-backend

# Frontend
cd web && npm run build
pm2 start npm --name chestone-frontend -- start
```

## Known scope notes

- The ad-performance rule engine does not warrant a specific ROAS/CPL outcome — it flags/throttles based on configured thresholds and improves in usefulness as more historical data accumulates.
- Payments are a record-keeping ledger only; no real payment processing (M-Pesa/Stripe/etc.) happens on this platform.
- Property media upload is manual (Cloudinary) — there is no AI video generation pipeline.
