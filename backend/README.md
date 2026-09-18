# Gateway Quest (GQ) backend

Channex.io channel-manager integration middleware. `BQ/HMS ↔ GQ ↔ Channex`.

BQ remains the source of truth for hotel/property data - GQ never duplicates it. GQ's
own tables (`gq_*`, see `prisma/schema.prisma`) live in **the same physical database**
BQ and EQ use - not a separate one - mirroring the `aq_*` convention EQ already
follows. GQ only stores integration-specific state there: rate plans, restrictions,
channel mappings, OTA bookings, and API/webhook/error logs. Property onboarding state
specifically (`cx_property_id`) is **not** duplicated anywhere in `gq_*` - it lives
only on `BQ.property.cx_property_id`, which GQ reads through BQ's own API.

> **Schema provenance:** every `gq_*` model here (except `gq_user`) was adopted from an
> in-progress, uncommitted schema found in a separate local working copy of this repo
> ("QUEST - Copy"), per explicit direction, in place of an earlier, independently
> designed schema. `gq_user` is the one model added fresh, to satisfy this
> integration's explicit requirement that GQ persist only a `bq_user_id` link and never
> a password - the adopted source didn't have an equivalent table.
>
> Two fields on `property` were carried over as-is from that source without their
> intended meaning being confirmed: `concorded` (a boolean sitting right next to
> `cx_property_id` - possibly meant as an onboarded flag, but not used as one here
> since it wasn't confirmed) and `group_id`. Neither is read or written by any code in
> this phase - onboarded status is derived purely from `cx_property_id !== null`.

## Scope of this phase

- `POST /api/gq/auth/login` - authenticates against BQ/EQ's existing login API
  (`POST /aq/api/login`), then issues a GQ session token. No password is ever stored
  in GQ.
- `GET /api/gq/properties/:propertyId` - returns a UI-safe subset of the BQ property,
  plus its Channex onboarding state (from `cx_property_id`).
- `POST /api/gq/properties/:propertyId/onboard` - idempotently creates the property on
  Channex and stores the returned id on `BQ.property.cx_property_id`. Idempotency is
  just "does BQ already have a `cx_property_id`?" - there's no separate GQ-side cache
  of that fact to go stale.

Only `gq_user` and `gq_api_log` (outbound Channex call logging) are actually used by
code in this phase. The other 14 `gq_*` tables (rate plans, restrictions, channels,
OTA bookings, webhook log, error queue, account config, availability snapshots) are
declared and ready for the next phases of this integration but nothing here queries
them yet.

## Prerequisites before this runs against anything real

1. **Run the BQ schema migration.** This change adds nullable columns to BQ's
   `property` table and 16 new `gq_*` tables to `bq/backend/app/prisma/schema.prisma`,
   and regenerates the BQ Prisma client. This was **not** applied to a live database
   from here - no `DATABASE_URL`/DB credentials were available, and `prisma db
   push`/`migrate` against a shared production-adjacent database is not something to
   run without explicit sign-off. Someone with BQ DB access needs to run
   `prisma generate` + `prisma db push` (or a proper migration) in `bq/backend`.
   Per `CHANNEX_INTEGRATION_ANALYSIS.md` section 0.5, `eq` and `pricing-service` carry
   their own copies of the same schema - mirror this into those two copies as well
   before either service needs these fields/tables.
2. **Set `DATABASE_URL`** in `gq/.env` to the *same* connection string
   `bq/backend/.env` uses - this is one shared database, not two.
3. **Get a real Channex API key** for the target environment and set
   `CHANNEX_API_KEY`. `CHANNEX_ENVIRONMENT=staging` uses Channex's documented staging
   base URL by default; `production` requires `CHANNEX_BASE_URL` to be set explicitly
   (Channex's production base URL was not confirmed from their own docs during this
   integration's research - see `CHANNEX_BQ_API_DB_MAPPING.md` section 9). Note:
   `gq_account_config` exists in the schema for DB-stored, rotatable API keys, but this
   phase reads `CHANNEX_API_KEY` from the environment instead, per the explicit "secrets
   must come from environment/configuration" requirement - switching to DB-stored keys
   is a deliberate follow-up decision, not made here.
4. **Populate the new BQ property fields** (`currency`, `country`, `city`, `address`,
   `time_zone` are required by Channex) for any property before calling `/onboard` -
   this service validates they're present and returns a clear `422
   PROPERTY_MISSING_CHANNEX_FIELDS` listing what's missing rather than guessing
   defaults. Populating them is a BQ property-admin concern, out of scope here.

## Known limitations carried over from BQ/EQ, not fixed here

- `POST /aq/api/login` has three other success paths this service doesn't attempt to
  complete on the caller's behalf: MFA pending, first-login property registration
  pending, and email-verification pending. Each surfaces as its own clear GQ error
  (`MFA_REQUIRED`, `PROPERTY_REGISTRATION_REQUIRED`, `EMAIL_VERIFICATION_REQUIRED`)
  telling the user to finish that step in the existing HMS UI first.
- BQ's property API (`/bq/api/properties/...`) has no authentication or ownership
  checks of its own - GQ enforces `aq_users.property_id === propertyId` itself before
  ever calling BQ. This means BQ's property endpoints are only safe to expose on a
  network GQ (and nothing untrusted) can reach.
- `eq/backend/app/api/userManagement/utils/jwt.py` signs BQ/EQ's own login tokens with
  a hardcoded secret (`"Rohit@~123"`). GQ does not reuse this secret or trust EQ's
  token at all - GQ signs its own session token with `GQ_JWT_SECRET`. Flagging this
  because it's a real, unrelated security issue worth fixing separately, not because
  GQ depends on it.

## Running locally

```bash
npm install
cp .env.example .env   # fill in real values per "Prerequisites" above
npm run prisma:generate
npm run dev
```

`GET /health` returns `{"status":"ok","service":"gq-backend"}` once it's up - this
does not require a database connection (Prisma connects lazily on first query).

## Project structure

```
gq/
├── prisma/schema.prisma        gq_* tables in BQ's shared database (see provenance note above)
└── src/
    ├── config/env.ts           All env vars read and validated here, once
    ├── modules/
    │   ├── auth/                POST /api/gq/auth/login
    │   ├── property/            GET /api/gq/properties/:id (+ the /onboard route, same URL namespace)
    │   └── channex/             Onboarding orchestration + BQ-property -> Channex payload mapping
    ├── clients/
    │   ├── bq/                  axios calls to EQ (login) and BQ (property read/write)
    │   └── channex/             axios calls to Channex, incl. meta.warnings handling + gq_api_log
    ├── middleware/               requestId, authenticate, errorHandler, asyncHandler
    ├── routes/index.ts           Mounts module routers under /api/gq
    ├── repositories/             Thin Prisma query wrappers (gq_user, gq_api_log)
    ├── errors/AppError.ts        Typed errors -> HTTP status mapping
    ├── types/express.d.ts        Request augmentation (correlationId, user)
    └── app.ts / server.ts
```

Not included in this phase, per explicit scope: Redis, queues/BullMQ, Docker/CI/CD/
Kubernetes, ESLint/Prettier/Husky, Swagger/OpenAPI.
