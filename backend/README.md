# Gateway Quest (GQ) Backend

Node.js/TypeScript middleware that integrates the HMS (EQ/BQ) monorepo with the
[Channex.io](https://docs.channex.io) channel manager. GQ sits between BQ (property/room
data) and Channex: it onboards properties, room types and rate plans to Channex, and
pushes/reads Availability, Rates & Restrictions (ARI).

GQ owns no property/room-type data of its own - that lives in BQ and is read over BQ's
existing HTTP API (`src/clients/bq`). GQ only persists its own rate plans, restrictions,
availability snapshots and integration bookkeeping (the `gq_*` tables, in the **same**
physical Postgres database BQ/EQ use - not a separate database).

## Stack

- Node.js + TypeScript + Express
- Prisma (schema in `prisma/schema.prisma`) for GQ's own `gq_*` tables
- Zod for request validation
- Axios for all upstream HTTP calls (BQ, EQ/AQ login, pricing-service, Channex)

Deliberately **not** used in this phase: Redis/queues/BullMQ, Docker, CI/CD, ESLint/Prettier/Husky.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in real values, see below
npm run prisma:generate
npm run dev             # ts-node-dev, auto-restarts on change
```

- `npm run build` — compile to `dist/` (`tsc -p tsconfig.build.json` - same as `tsconfig.json` but excludes `*.test.ts`)
- `npm run start` — run the compiled build (`node dist/server.js`)
- `npm run typecheck` — `tsc --noEmit` against `tsconfig.json` (includes tests), no build output
- `npm run test` — runs the automated test suite (vitest)
- `npm run prisma:generate` — regenerate the Prisma client after any `schema.prisma` change

The server listens on `GQ_PORT` (default `4000`) and exposes everything under `/api/gq`,
plus an unauthenticated `GET /health`.

Interactive API docs (Swagger UI) are at `GET /docs`, generated from the same Zod
schemas that validate every request (`src/docs/openapi.ts`) - not hand-written, and not
free the way FastAPI gives it to `bq`/`eq`/`pricing-service`, since Express has no
built-in equivalent. Raw OpenAPI 3.0 JSON is at `GET /openapi.json`.

## Environment variables

See `.env.example` for the full annotated list. Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Same physical Postgres database as BQ/EQ (`?schema=bq`) - **not** a separate GQ database |
| `GQ_JWT_SECRET` / `GQ_JWT_EXPIRES_IN_MINUTES` | Signs GQ's own session tokens (distinct from BQ/EQ's JWT secret) |
| `AQ_BASE_URL` | EQ/AQ service, used only for `POST /aq/api/login` during GQ login |
| `BQ_BASE_URL` | BQ service - source of truth for property/room-type data |
| `PRICING_SERVICE_BASE_URL` | pricing-service - source of truth for rates, read during ARI restriction pushes |
| `CHANNEX_ENVIRONMENT` / `CHANNEX_BASE_URL` / `CHANNEX_API_KEY` | Channex.io API access (`user-api-key` header) |
| `UPSTREAM_TIMEOUT_MS` | Timeout applied to every outbound HTTP call |

`.env` is gitignored and must never be committed - it holds real secrets locally.

## Project layout

```
src/
  app.ts                 Express app wiring (JSON body parsing, request id, routes, error handler)
  server.ts              Process entrypoint - starts the HTTP server
  config/env.ts           Zod-validated environment schema
  errors/AppError.ts      Typed application errors + factory functions
  middleware/             authenticate, asyncHandler, errorHandler, requestId
  services/logger.ts       Structured logging
  types/express.d.ts       Express Request augmentation (req.user, req.correlationId)

  clients/                 Server-to-server HTTP clients to upstream services
    bq/                     BQ property/room-type/availability reads, Channex-mapping patches
    channex/                Channex.io API (property/room-type/rate-plan create, ARI push + read-back)
    pricingService/         pricing-service rates (GET /dynamic-prices-calendar)

  repositories/             Thin Prisma wrappers, one per gq_* model - no business logic
  modules/                  One folder per feature: <name>.routes.ts, .service.ts, .schema.ts (Zod), .dto.ts, .test.ts
    auth/                    GQ login (delegates credential check to EQ/AQ, mints GQ's own JWT)
    property/                Property read + onboarding endpoints
    channex/                 BQ -> Channex mapping/payload builders and onboarding orchestration
    ratePlan/                GQ-owned rate plan CRUD + Channex rate-plan onboarding
    ari/                     Availability, Rates & Restrictions (ARI) - see below
    channel/                 Channel connection + OTA room/rate mapping - see below
    booking/                 Booking ingestion (webhook + revision feed) - see below

  docs/openapi.ts           Builds the Swagger/OpenAPI document served at GET /docs

prisma/schema.prisma        GQ's own gq_* tables (mappings, rate plans, restrictions, snapshots, OTA
                             bookings, push-task/API/webhook/error logs) - shares BQ's physical database

scripts/                    One-off maintenance/debug scripts - see Testing below
  mint-test-token.js         Signs a fake-but-valid GQ session JWT for manual API testing
  reset-channex-mapping.js   Clears a property's Channex onboarding state (BQ + GQ) back to "never onboarded"
  run-revision-feed.ts       Booking Revision Feed recovery poller - run via an external scheduler, not the app
```

## API

All routes below are mounted under `/api/gq`. Every route except `POST /auth/login`
requires `Authorization: Bearer <token>` from that login response.

### Auth
- `POST /auth/login` - authenticates against EQ/AQ, mints a GQ session token

### Property & onboarding
- `GET /properties/:propertyId` - BQ property details + Channex onboarding status
- `POST /properties/:propertyId/onboard` - onboard a property to Channex (idempotent)
- `POST /properties/:propertyId/room-types/onboard` - onboard all of a property's room types (idempotent per room type)

### Rate plans (`/rate-plans`)
- `GET /rate-plans`, `GET /rate-plans/:ratePlanId` - list/read GQ-owned rate plans
- `POST /rate-plans` - create a rate plan and onboard it to Channex (idempotent by room type + name)
- `PUT /rate-plans/:ratePlanId` - update local fields/options
- `DELETE /rate-plans/:ratePlanId` - delete the local rate plan (no confirmed Channex delete endpoint - Channex side is left in place)

### ARI - Availability, Rates & Restrictions
- `GET /properties/:propertyId/ari` - GQ's own last-known restrictions + availability snapshots for a date range
- `GET /properties/:propertyId/ari/availability` - live availability read straight from BQ
- `POST /properties/:propertyId/ari/restrictions` - push rate/min-stay/max-stay/stop-sell values for one rate plan to Channex; `rate` falls back to pricing-service when omitted
- `POST /properties/:propertyId/ari/availability` - push explicit per-room-type, per-date availability to Channex

ARI pushes are validated before anything is sent to Channex (property/room-type/rate-plan
must already be mapped to Channex, availability is oversell-guarded against BQ's actual
room count, rate must be > 0), converted to Channex's minor currency units via
`src/lib/currency.ts` (never a hardcoded `x100`), and confirmed with a read-back
immediately after pushing (`verified` in the response) since Channex processes ARI pushes
asynchronously and documents no task-status endpoint to poll.

### Channels & OTA mapping
- `GET /properties/:propertyId/channels` - list a property's connected channels (syncs into GQ's local cache)
- `POST /properties/:propertyId/channels/connect-token` - generate a Channex one-time token + IFrame URL (single-use, 15 min)
- `GET /channels/:channelId` - one channel's live details/status
- `POST /channels/:channelId/activate` / `POST /channels/:channelId/deactivate`
- `GET /channels/:channelId/mappings` - read + sync current room/rate mappings from Channex
- `DELETE /channels/:channelId/mappings/:mappingId` - remove GQ's local cached copy of a mapping only

Channex has **no REST API to create, update or delete a room/rate mapping** - that only
happens through the hosted IFrame "mapping screen" the one-time token unlocks. GQ reads
the result back afterward and caches it locally in `gq_channel_mapping`, which is what
`GET /channels/:channelId/mappings` does on every call. A mapping only gets synced when
GQ can resolve *both* its room type and rate plan to something already onboarded on that
same property - anything Channex reports that GQ doesn't recognize is silently skipped
rather than guessed at.

**Real bug found and fixed (2026-09-28):** the sync used to read
`relationships.known_mappings` off the channel detail response - a real field, but
confirmed **empty** on a live channel that genuinely had working mappings configured
through the hosted screen, so "resync" always returned `[]` regardless of what was
actually mapped. The real, confirmed-live source of truth is
`attributes.settings.mappingSettings.rooms` (OTA room code -> GQ room type id) joined
with `attributes.rate_plans` (each entry carries its own OTA room/rate codes plus the
resolved `rate_plan_id` directly). `listAndSyncMappings()` now reads from there instead
- verified live against a real channel, 3 real mappings now sync correctly where `[]`
came back before.

### Account config (`/account-config`) - Super_Admin only
- `POST /account-config` - create a Channex account/webhook config. Generates a random
  `webhook_secret` server-side and returns it **once**, in this response only - not
  retrievable again afterward. Requires the caller's GQ token to carry BQ's
  `Super_Admin` role (passed through as-is from BQ's own login response).
- `GET /account-config` - list configs (`webhookSecret` never included).

### Monitoring (`/monitoring`) - Super_Admin only
Plain, unfiltered, account-wide audit trails - none of these 4 tables carry a
`bq_property_id`, so they're not scoped to a single property's staff. All four take an
optional `?limit=` (default 100, max 500) and return newest-first.
- `GET /monitoring/tasks` - `gq_push_task`, one row per ARI availability/restrictions
  push (`ari.service.ts`) - already populated by existing ARI code, nothing new wired up.
- `GET /monitoring/api-logs` - `gq_api_log`, every outbound call GQ makes to Channex,
  including the full request (query params + body) and response, since 2026-09-30.
  Captured once, centrally, via a request/response interceptor pair on `channexHttp`
  (`channex.client.ts`) - replaced ~22 individual call sites that each manually tracked
  their own `startedAt`/`httpStatus` purely to call this, on both the success and error
  path (also fixed two call sites, `getChannexAvailability`/`getChannexRestrictions`,
  that weren't logging at all before). Known sensitive field names (API key, card
  number, cvv, password, token, etc.) are redacted recursively before anything is
  persisted (`redact()`, exported and unit-tested) - defense in depth on top of
  Channex's own partial card masking, never a substitute for it.
- `GET /monitoring/webhook-log` - `gq_webhook_log`. This table existed in the schema but
  nothing ever wrote to it - `booking.routes.ts` now logs one row per accepted
  `POST /webhooks/channex` call (after the shared-secret check passes). `attempt` is
  GQ's own count of how many times a given `ref` (Channex booking/revision id) has been
  seen - Channex's webhook payload carries no retry number of its own.
- `GET /monitoring/error-queue` - `gq_error_queue`. Also previously unused - now written
  from the webhook's fire-and-forget async processing catch block specifically (the one
  place in the app where an error was logged and then silently dropped with nothing else
  to inspect it by later). Not a general-purpose error log for every failure path in the
  app - deliberately narrow, to avoid inventing a broader error-handling policy nobody
  asked for.

### Booking ingestion (Phase 6)
- `POST /webhooks/channex` - **public, no GQ session token.** Verified by a shared-secret
  header (`x-channex-webhook-secret`) instead - see setup below. Responds `200`
  immediately, then processes the booking revision asynchronously within the same
  process (fire-and-forget, not a queue).
- `GET /properties/:propertyId/bookings` - list GQ's persisted OTA bookings for a
  property (optional `status` filter). Read-only - mirrors Channex's own read-only
  [Bookings Collection API](https://docs.channex.io/api-v.1-documentation/bookings-collection);
  bookings are only ever created by ingestion, never by a direct write here.
- `GET /properties/:propertyId/bookings/:bookingId` - one booking with its full revision
  history embedded.
- `GET /properties/:propertyId/booking-revisions` - list revisions across every booking
  on a property (optional `ackStatus` filter) - useful to find stuck/blocked ones
  (`blockingReason`, `processingAttempts`) without knowing a booking's id up front.
- `GET /properties/:propertyId/booking-revisions/:revisionId` - one revision.

Flow: `OTA -> Channex -> webhook/revision feed -> GQ (mapping + idempotency) -> BQ booking
API -> verify -> acknowledge Channex`. Both the webhook and
`scripts/run-revision-feed.ts` (the ~15-minute recovery poller for anything missed) call
the exact same `processRevision()` in `booking.service.ts` - idempotency is keyed on
Channex's own `revision_id` (`gq_ota_booking_revision.cx_revision_id` is unique), and an
already-created BQ booking is never re-created even on a retried "new" revision.

**One-time setup required before this can receive anything:**
1. Create a `gq_account_config` row via the admin API (there are none yet - every
   webhook call is rejected with `401` until one exists):
   ```bash
   TOKEN=$(node scripts/mint-test-token.js 1)   # roles: ["Super_Admin"]
   curl -s -X POST http://localhost:4000/api/gq/account-config \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"webhookUrl":"https://<your-public-host>/api/gq/webhooks/channex","apiKey":"<channex-api-key>","environment":"production"}'
   ```
   Copy `webhookSecret` from the response - it's shown **once** and never returned
   again (`GET /account-config` redacts it on every later read).
2. Register the webhook with Channex (`POST {CHANNEX_BASE_URL}/webhooks`), pointing
   `callback_url` at `https://<your-public-host>/api/gq/webhooks/channex` and setting
   `headers: {"x-channex-webhook-secret": "<webhookSecret from step 1>"}`.
3. For local dev without a public URL, run the recovery poller manually instead of
   relying on the webhook - see below.

**Real, confirmed BQ limitation, not silently worked around:** BQ's booking-creation
endpoint (`POST /create-reservation-online-new/`) hardcoded `booking_type="Online"`,
`booking_status="Soft"`, and always recalculated price from BQ's own base rate - none of
which fit an OTA booking. Fixed with a **minimal, additive** change to
`bq/backend/app/api/checkIn/routes/booking.py`: three new **optional** fields
(`booking_type`, `booking_status`, `fixed_amount`) that default to the exact original
hardcoded behavior when omitted, so every existing caller (walk-in, direct online
bookings) is unaffected. `POST /modify-booking/` has no equivalent amount override, so a
modified OTA booking's amount in BQ may not match Channex's revised amount - documented,
not solved, in this pass.

`booking_status` must be `"Hard"` for a confirmed OTA booking, not `"Confirmed"` - BQ's
`bq.booking` table has a real Postgres CHECK constraint (`booking_booking_status_check`)
allowing only `Soft`/`Hard`/`Checkedout`/`Cancelled`. An earlier pass used `"Confirmed"`,
which made every OTA booking creation fail with an unhandled `500`; found and fixed by
testing live against BQ (see `webhooks.md` for the full story and the local simulation
script used to verify it end-to-end without needing a real Channex test booking).

Run the recovery poller (do this deliberately - it can create/cancel/modify real
bookings):
```bash
npx ts-node scripts/run-revision-feed.ts
```
In production, trigger it roughly every 15 minutes via cron / Windows Task Scheduler
(exact commands in the script's own header comment) - deliberately not an in-process
`setInterval` or a queue, to avoid new deployment infrastructure.

For local testing without Channex (e.g. before the Booking CRS App / Open Channel is set
up on the Channex side), `scripts/simulate-booking-revision.ts` drives the same
`processRevision()` with a synthetic but schema-accurate revision - see `webhooks.md`
("Creating test bookings") for usage and its one caveat (the final Channex-ack call
can't succeed for a synthetic revision).

## Known upstream limitations

- BQ has no itemized per-day availability endpoint - only a single-night, date-scoped one
  (`GET /bq/api/availability/check-dates/all`). `getBqAvailabilityForDateRange` calls it
  once per date in bounded-concurrency batches rather than adding a new BQ endpoint.
- Channex documents no endpoint to poll an ARI push's task by id/status - GQ instead reads
  the value straight back via `GET /api/v1/availability` / `GET /api/v1/restrictions`
  right after pushing, and records the result on the `gq_push_task` row.
- Channex has no REST API for creating/updating/removing channel room/rate mappings (see
  above) - only the hosted IFrame UI can write them; GQ is read-only for mappings.
- Channex documents no cryptographic webhook signature scheme at all - only a
  shared-secret header you configure yourself. `POST /webhooks/channex` is verified
  that way, not by HMAC/signature (there is nothing stronger to verify against).
- BQ's booking API has no idempotency key of its own, and `GET /bq/api/bookings/` has no
  filter params (fetches every booking; GQ filters client-side) - both are pre-existing
  BQ gaps GQ works around rather than fixes.
- BQ's booking-creation room-type matching is by name only, case-insensitive, with no
  property scoping on BQ's side - if two properties ever have identically-named room
  types this is a pre-existing BQ ambiguity risk, not something GQ can fix without
  touching BQ's matching logic.
- A revision for a Channex property GQ can't resolve to any onboarded BQ property can't
  be persisted at all (`gq_ota_booking.bq_property_id` is required, and there is no
  valid property to satisfy it) - logged clearly instead of silently dropped, and left
  to Channex's own retry backoff / the revision feed to keep re-surfacing it. This
  should only happen if a webhook arrives for a property whose channel connection
  couldn't legitimately have existed.
- A booking revision covering more than one distinct room type only creates a BQ
  booking for the first resolved group - true mixed-room-type single-reservation
  bookings are a known gap, not handled in this pass.

## Testing

### Automated (`npm run test`)
Runs the vitest suite (67 tests):
- `channel` module - Zod schema validation, DTO mapping, and the mapping-sync business
  rules (same-property validation, skipping unresolvable/incomplete mappings, idempotent
  upsert).
- `booking` module - `booking.service.test.ts` covers `processRevision()`'s core rules
  (new/modified/cancelled bookings, idempotency on both the revision and the
  already-created-in-BQ level, unmapped room/rate plan, unknown property, missing guest
  email, BQ failure handling); `booking.routes.test.ts` is a real HTTP-level test
  (via `supertest`) of the webhook's shared-secret authentication specifically - no
  secret header, wrong secret, no secret configured at all, correct secret, and
  confirming no GQ session/Authorization header is required.
- `accountConfig` module - `accountConfig.service.test.ts` covers secret generation
  (random, unique per call) and that `listAccountConfigs` never surfaces
  `webhook_secret`; `accountConfig.routes.test.ts` is an HTTP-level test (via
  `supertest`, real signed JWTs) of the admin gate - no token, non-admin token, admin
  token, and body validation.
- Booking read APIs (`listBookingsForProperty`/`getBookingForProperty`/
  `listBookingRevisionsForProperty`/`getBookingRevisionForProperty` in
  `booking.service.test.ts`) - property ownership (`403`), not-found vs.
  wrong-property-in-URL (`404`), filter pass-through, and DTO mapping including the
  embedded revision history on a single booking.

All of the above mock `clients`/`repositories` via `vi.mock`, so no live DB or
Channex/BQ connection is needed to run them. Other modules (`auth`, `property`,
`ratePlan`, `ari`) have no automated tests yet. The revision-feed script's own
pagination/iteration logic is a thin wrapper around the already-tested
`processRevision()` and isn't separately unit tested - exercising it live requires a
real Channex connection and has real side effects (see below).

### Manual, against a live server
1. Start the server: `npm run dev`
2. Mint a test session token (no real EQ/AQ login needed):
   ```bash
   node scripts/mint-test-token.js <propertyId>
   ```
3. Call any route with it:
   ```bash
   TOKEN=$(node scripts/mint-test-token.js 1)
   curl -s http://localhost:4000/api/gq/properties/1 -H "Authorization: Bearer $TOKEN"
   ```
4. Or explore/try endpoints interactively at `GET /docs` (Swagger UI) - paste the same
   token into its "Authorize" button first.

`scripts/reset-channex-mapping.js <propertyId>` resets a property's onboarding state
(deletes its `gq_rate_plan`s, `gq_availability_snapshot`s, and every `gq_ota_booking`/
`gq_ota_booking_revision` (plus their rooms/guests/taxes), then clears
`cx_property_id`/`cx_room_type_id` in BQ) if you need to re-test the onboarding or
booking-ingestion flow from scratch.
