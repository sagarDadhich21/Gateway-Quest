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

Deliberately **not** used in this phase: Redis/queues/BullMQ, Docker, CI/CD, ESLint/Prettier/Husky, Swagger.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in real values, see below
npm run prisma:generate
npm run dev             # ts-node-dev, auto-restarts on change
```

- `npm run build` — compile to `dist/` (`tsc -p tsconfig.json`)
- `npm run start` — run the compiled build (`node dist/server.js`)
- `npm run typecheck` — `tsc --noEmit`, no build output
- `npm run prisma:generate` — regenerate the Prisma client after any `schema.prisma` change

The server listens on `GQ_PORT` (default `4000`) and exposes everything under `/api/gq`,
plus an unauthenticated `GET /health`.

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
  modules/                  One folder per feature: <name>.routes.ts, .service.ts, .schema.ts (Zod), .dto.ts
    auth/                    GQ login (delegates credential check to EQ/AQ, mints GQ's own JWT)
    property/                Property read + onboarding endpoints
    channex/                 BQ -> Channex mapping/payload builders and onboarding orchestration
    ratePlan/                GQ-owned rate plan CRUD + Channex rate-plan onboarding
    ari/                     Availability, Rates & Restrictions (ARI) - see below

prisma/schema.prisma        GQ's own gq_* tables (mappings, rate plans, restrictions, snapshots, OTA
                             bookings, push-task/API/webhook/error logs) - shares BQ's physical database
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

## Known upstream limitations

- BQ has no itemized per-day availability endpoint - only a single-night, date-scoped one
  (`GET /bq/api/availability/check-dates/all`). `getBqAvailabilityForDateRange` calls it
  once per date in bounded-concurrency batches rather than adding a new BQ endpoint.
- Channex documents no endpoint to poll an ARI push's task by id/status - GQ instead reads
  the value straight back via `GET /api/v1/availability` / `GET /api/v1/restrictions`
  right after pushing, and records the result on the `gq_push_task` row.
