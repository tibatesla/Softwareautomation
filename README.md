# Chestone Pipeline

[![GitHub Repo](https://img.shields.io/badge/GitHub-Chestone-181717?logo=github)](https://github.com/tibatesla/Chestone)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

Chestone Pipeline is a TypeScript/Express backend that turns a real-estate lead or property record into an AI-generated, branded vertical video and hands the finished asset off to Make.com for ad distribution (Meta, TikTok, Google).

This document describes what the code **actually does today**, based on the current state of [src/](src/). Where something is implemented but not wired up (or wired up but broken), it's called out explicitly in [Known issues](#known-issues-and-incomplete-areas) rather than presented as working.

## Pipeline flow

Two entry points currently create property records and kick off rendering:

- `POST /api/webhooks/manual-intake` — token-protected manual/test intake, validated with Zod.
- `POST /api/test-pipeline` — inserts a hardcoded mock property, no validation.

From there, both paths converge on the same async pipeline:

```text
Property record inserted into Supabase (status: PENDING_INGESTION)
  -> job pushed onto the Bull/Redis "video-generation-pipeline" queue
  -> video.worker.ts picks up the job
  -> heygen.service.ts picks a video "variant" + persona, calls the HeyGen API
     (status: RENDERING)
  -> HeyGen renders the video and calls back POST /api/webhooks/heygen
     (HMAC-SHA256 signature verified against the raw request body)
  -> ffmpeg.service.ts downloads the HeyGen clip + 2 property photos and
     stitches a 15s branded 1080x1920 video (Ken Burns intro/outro + HeyGen
     mid-clip + Chestone branding overlay)
  -> gcs.service.ts uploads the rendered file to Google Cloud Storage and
     returns a signed URL
     (status: COMPLETED, gcs_video_url set)
  -> make.service.ts fires the finished asset at a Make.com webhook, which is
     responsible for actually creating the Meta/TikTok/Google ad campaigns
  -> a row per platform is seeded into fact_creative_performance for later
     cost-per-acquisition tracking
```

Two cron jobs run alongside this pipeline (see [Cron jobs](#cron-jobs)):

- Hourly: reads `fact_creative_performance` and marks a creative `THROTTLED` if its computed CPA exceeds KES 4,500.
- Daily at midnight: deletes `chestone_properties` rows older than 30 days that are `COMPLETED` or `FAILED`.

## Architecture

- **Routes** ([src/routes/](src/routes/)) accept HTTP requests and mount controllers.
- **Controllers** ([src/controllers/](src/controllers/)) orchestrate a single webhook/endpoint's logic.
- **Services** ([src/services/](src/services/)) wrap a single external integration or concern (Supabase, HeyGen, ffmpeg, GCS, Make.com, WhatsApp, lead tracking).
- **Queue** ([src/config/queue.config.ts](src/config/queue.config.ts), [src/queues/video.worker.ts](src/queues/video.worker.ts)) — Bull/Redis queue that decouples ingestion from HeyGen rendering.
- **Cron** ([src/cron/](src/cron/)) — scheduled maintenance and monitoring jobs, started once from [src/server.ts](src/server.ts).
- **Supabase** (PostgreSQL) is the single datastore — no ORM, calls go through `@supabase/supabase-js`.

## Technology stack

- Runtime: Node.js 20, TypeScript
- Web framework: Express 4
- Validation: Zod
- Queueing: Bull + Redis
- Data store: Supabase (PostgreSQL-backed)
- Video processing: `ffmpeg` (via `execFile`, no JS ffmpeg wrapper library)
- Containerization: Docker + Docker Compose
- External integrations: HeyGen, Google Cloud Storage, Make.com, GoHighLevel, WhatsApp Cloud API

## Project structure

```text
src/
  app.ts                          # Express app: middleware, health check, route mounting
  server.ts                       # Boot sequence, cron init, graceful shutdown
  config/
    queue.config.ts                # Bull/Redis queue instance + VideoJobPayload type
  controllers/
    heygen.controller.ts           # HeyGen render-complete callback -> ffmpeg -> GCS -> Make.com
    manual-intake.controller.ts    # Token-protected manual property intake
    crm.controller.ts              # NOT WIRED UP — see Known issues
  cron/
    index.ts                       # Starts sanitization + budget-monitor crons on boot
    sanitization.ts                # Daily 30-day purge of terminal-state properties
    budgetMonitor.ts                # Hourly CPA check against fact_creative_performance
    ghl-poller.cron.ts              # GoHighLevel polling job — implemented but not started
  middlewares/
    auth.middleware.ts             # AuthenticatedRequest type (adds req.rawBody)
  queues/
    video.worker.ts                # Consumes the video-generation queue, calls heygen.service
  routes/
    webhook.routes.ts              # POST/OPTIONS /heygen (signature-verified)
    test.routes.ts                 # POST /test-pipeline, POST /webhooks/manual-intake
    crm.routes.ts                  # NOT MOUNTED, does not compile — see Known issues
  schemas/
    validation.schema.ts           # Zod schema for manual/GHL property ingestion
  services/
    heygen.service.ts              # Builds the HeyGen request, persona/variant selection
    ffmpeg.service.ts               # Vertical video stitch + branding overlay
    gcs.service.ts                  # Uploads rendered video to GCS, returns signed URL
    make.service.ts                 # Posts the finished asset to the Make.com webhook
    supabase.service.ts             # Supabase client + unused VectorSearchService
    tracking.service.ts             # PII hashing/phone normalization — only used by crm.controller.ts
    whatsapp.service.ts             # WhatsApp video blast — implemented, currently unused
  utils/
    logger.ts                       # Empty placeholder
    personaMapper.ts                # Empty placeholder
Dockerfile
docker-compose.yml
package.json
tsconfig.json
captured_payload.json             # Sample HeyGen callback payload, kept for local testing reference
```

## API endpoints

### Health check

- `GET /health` — returns `{ status, message, timestamp }`.

### Ingestion

- `POST /api/webhooks/manual-intake?token=<MANUAL_WEBHOOK_SECRET>` — validates the body against `propertyIngestionSchema`, upserts into `chestone_properties` (keyed on `property_unique_id`), and queues a render job. Returns 401 if the token doesn't match.
- `POST /api/test-pipeline` — inserts a hardcoded mock property (no request body needed) and queues a render job. Useful for exercising the pipeline end-to-end without a real CRM payload.

### HeyGen callback

- `OPTIONS /api/webhooks/heygen` — CORS preflight, returns `200 ok`.
- `POST /api/webhooks/heygen` — HeyGen render-complete callback. Requires a valid `Heygen-Signature` (or `X-Signature`) header; the body is HMAC-SHA256 verified against `HEYGEN_WEBHOOK_SECRET` using the raw request bytes captured in [app.ts](src/app.ts). Non-success event types are acknowledged and ignored.

### Static files

- `GET /rendered-videos/*` — serves files from a hardcoded local path. Currently dead: ffmpeg writes its output to the OS temp directory and the file is deleted after upload, so nothing is ever served from here (see [Known issues](#known-issues-and-incomplete-areas)).

## Environment variables

These are the variables the code actually reads from `process.env`:

```env
PORT=3000
NODE_ENV=development
REDIS_URL=redis://127.0.0.1:6379

SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

HEYGEN_API_KEY=your_heygen_api_key
HEYGEN_WEBHOOK_SECRET=your_heygen_webhook_secret

GCP_BUCKET_NAME=your_gcs_bucket
# GCS auth is handled by the @google-cloud/storage SDK's default credential
# resolution (e.g. GOOGLE_APPLICATION_CREDENTIALS pointing at a service account
# JSON file, or ADC in a GCP environment) — not read directly by this app's code.

MAKE_WEBHOOK_URL=your_make_com_custom_webhook_url
PIPELINE_TEST_MODE=false   # true forces $0 budget + test_mode:true in the Make.com payload

MANUAL_WEBHOOK_SECRET=choose_a_real_secret   # falls back to a hardcoded default if unset — see Known issues

# Read by code paths that exist but are currently unused or disabled:
GHL_API_TOKEN=              # ghl-poller.cron.ts (not started)
GHL_PROPERTY_OBJECT_ID=     # ghl-poller.cron.ts (not started)
WHATSAPP_PHONE_NUMBER_ID=   # whatsapp.service.ts (not called anywhere)
WHATSAPP_ACCESS_TOKEN=      # whatsapp.service.ts (not called anywhere)
```

## Local development

### Prerequisites

- Node.js 20+ and npm
- Redis
- `ffmpeg` available on `PATH` (used directly via `execFile`, not bundled)
- Docker (optional, recommended for Redis)

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root with the variables listed above.

3. Start Redis locally or with Docker:

   ```bash
   docker compose up -d chestone-redis
   ```

4. Start the application:

   ```bash
   npm run dev
   ```

   This uses `nodemon` + `ts-node` and restarts on source changes. The server boots the Express app, starts the two active cron jobs, and starts the video queue worker automatically.

### Scripts

- `npm run dev` — start in development mode with nodemon
- `npm run build` — compile the TypeScript project with `tsc`
- `npm start` — run the compiled server from `dist/`

## Docker deployment

```bash
docker compose up --build -d
```

This builds and starts the app on port 3000 and Redis on port 6379, using `env_file: .env` for secrets.

## Cron jobs

Started once from [src/cron/index.ts](src/cron/index.ts) when the server boots:

- **Sanitization** ([sanitization.ts](src/cron/sanitization.ts)) — daily at midnight, permanently deletes `chestone_properties` rows older than 30 days with status `COMPLETED` or `FAILED`.
- **Budget monitor** ([budgetMonitor.ts](src/cron/budgetMonitor.ts)) — hourly, computes CPA (spend / clicks, converted to KES at a fixed rate) per creative in `fact_creative_performance` and flips status to `THROTTLED` above KES 4,500. The alerting hook (WhatsApp/SMS to the team) is a `TODO` in the code, not implemented.

Not started (implemented but commented out in `cron/index.ts`):

- **GHL poller** ([ghl-poller.cron.ts](src/cron/ghl-poller.cron.ts)) — would poll GoHighLevel custom objects every 10 minutes, upsert them into `chestone_properties`, and either queue a render job or bypass straight to Make.com if a `manual_video_url` is present.

## Known issues and incomplete areas

- **`npm run build` currently fails.** `tsc --noEmit` reports two errors:
  - [src/routes/crm.routes.ts](src/routes/crm.routes.ts) imports `verifyLoftyWebhookSignature` from [auth.middleware.ts](src/middlewares/auth.middleware.ts), which only exports the `AuthenticatedRequest` type — that function doesn't exist.
  - [src/services/tracking.service.ts](src/services/tracking.service.ts) passes a `string` where `libphonenumber-js` expects a `CountryCode`.
  `npm run dev` still works because `ts-node`/`nodemon` only compiles files actually reachable from `server.ts`'s import graph, and `crm.routes.ts` isn't imported anywhere.
- **CRM webhook flow is dead code.** [crm.controller.ts](src/controllers/crm.controller.ts) and [crm.routes.ts](src/routes/crm.routes.ts) implement a `Tour_Scheduled`-triggered flow with PII hashing via [tracking.service.ts](src/services/tracking.service.ts), but the route is never mounted in [app.ts](src/app.ts) and doesn't compile as-is.
- **`whatsapp.service.ts`** is fully implemented (sends a rendered video via the WhatsApp Cloud API) but nothing in the current pipeline calls it.
- **`VectorSearchService`** in [supabase.service.ts](src/services/supabase.service.ts) (pgvector similarity search) is defined but never called.
- **`utils/logger.ts` and `utils/personaMapper.ts`** are empty placeholder files.
- **Manual intake token has a hardcoded fallback** (`Tesla_Chestone_Secure_9988` in [manual-intake.controller.ts](src/controllers/manual-intake.controller.ts)) if `MANUAL_WEBHOOK_SECRET` isn't set — set the env var in any real deployment.
- **`/rendered-videos` static route** in [app.ts](src/app.ts) points at a hardcoded absolute path (`/home/tesla/chestone-pipeline/output`) that won't exist in Docker (`WORKDIR /app`) and isn't written to by the current ffmpeg flow (output goes to the OS temp dir and is deleted after upload) — effectively dead.
- **HeyGen persona pool** in [heygen.service.ts](src/services/heygen.service.ts) uses the same placeholder `avatar_id`/`voice_id` for every persona in every variant — real per-persona IDs need to be filled in before the A/B selection logic has any effect.
- **Make.com test-mode guard only works if Make.com respects it.** `PIPELINE_TEST_MODE=true` sends `test_mode: true` and a $0 budget in the payload, but the Make.com scenario itself must branch on that field — the code can't enforce it from this side. See the comment block at the top of [make.service.ts](src/services/make.service.ts).
