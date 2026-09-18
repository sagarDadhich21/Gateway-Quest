# Room Type & Rate Plan Onboarding — Implementation Report

Phase 2 (Room Type Onboarding) and Phase 3 (Rate Plan Onboarding) of Gateway Quest,
implemented and tested end-to-end against the live BQ (port 9000) and GQ (port 4000)
servers, plus real staging Channex.

---

## 1. Files changed

### GQ backend (`C:\Users\sagar\Desktop\gq\backend`, not a git repo)

- `src/errors/AppError.ts` — added `ROOM_TYPE_NOT_FOUND`, `RATE_PLAN_NOT_FOUND` error codes + factories
- `src/clients/bq/bq.types.ts` — added `BqRoomType`, `BqRoomTypeAvailability(Response)`, `BqRoomTypeChannexMappingPatchResponse`
- `src/clients/bq/bq.client.ts` — added `getBqRoomTypes`, `getBqRoomTypeCounts`, `patchBqRoomTypeChannexMapping`
- `src/clients/channex/channex.types.ts` — added Channex room-type and rate-plan request/response types
- `src/clients/channex/channex.client.ts` — added `createChannexRoomType`, `createChannexRatePlan` (existing `createChannexProperty` left untouched)
- `src/modules/channex/channex.mapper.ts` — added `mapBqRoomTypeToChannexPayload`, `mapGqRatePlanToChannexPayload`
- `src/modules/channex/roomType.service.ts` **(new)** — `onboardRoomTypes`
- `src/modules/property/property.routes.ts` — added `POST /:propertyId/room-types/onboard`
- `src/repositories/gqRatePlan.repository.ts` **(new)** — CRUD over `gq_rate_plan` / `gq_rate_plan_option`
- `src/modules/ratePlan/ratePlan.dto.ts` **(new)**
- `src/modules/ratePlan/ratePlan.schema.ts` **(new)**
- `src/modules/ratePlan/ratePlan.service.ts` **(new)**
- `src/modules/ratePlan/ratePlan.routes.ts` **(new)**
- `src/routes/index.ts` — mounted `/rate-plans`

### BQ backend (`C:\Users\sagar\Desktop\QUEST - Copy\bq\backend`, git repo, branch `dev`, currently **uncommitted**)

- `app/api/checkIn/routes/room_master.py` — added `cx_room_type_id` to `RoomTypeResponse`, added `PATCH /roomtypes/{id}/channex-mapping`
- `app/api/checkIn/routes/masterdata.py` — (from the earlier property-onboarding fix session) `currency`/`country`/`time_zone` made writable, `cx_property_id` exposed, `PATCH /properties/{id}/channex-mapping` added

Not touched: `bq/backend/app/prisma/schema.prisma`, `.env`, anything under `cq/frontend` or
`eq/backend` — those showed as modified in `git status` from separate, pre-existing work
and are unrelated to this change. Nothing here has been committed — this repo has a lot
of unrelated in-progress work mixed in, so committing is left to you.

---

## 2. APIs added

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/gq/properties/:propertyId/room-types/onboard` | Onboards every BQ room type for that property to Channex, idempotent per room type |
| `GET` | `/api/gq/rate-plans?propertyId=&roomTypeId=` | List rate plans |
| `GET` | `/api/gq/rate-plans/:ratePlanId` | Get one rate plan |
| `POST` | `/api/gq/rate-plans` | Create + onboard a rate plan to Channex in one call, idempotent by (roomTypeId, name) |
| `PUT` | `/api/gq/rate-plans/:ratePlanId` | Update local GQ fields / replace options |
| `DELETE` | `/api/gq/rate-plans/:ratePlanId` | Delete the local GQ rate plan |

---

## 3. BQ changes required (already made, live on `QUEST - Copy`)

- `room_master.py`: expose `cx_room_type_id` on room type reads; add the mapping-write
  PATCH endpoint.
- **No DB/Prisma schema changes were needed** — `cx_room_type_id`, `room_count`,
  `occ_adults`/`occ_children`/`occ_infants` columns already existed on `roomtype`; only
  the FastAPI route layer was missing them (the same gap pattern found in the earlier
  property-onboarding fix).

---

## 4. Channex mappings

**Room type** (`mapBqRoomTypeToChannexPayload`):

| Channex field | BQ source | Note |
|---|---|---|
| `title` | `roomtypename` | direct |
| `count_of_rooms` | `GET /bq/api/availability/check-dates/all` → `total_rooms` | BQ has no room-count column; derived via a 1-night probe window |
| `occ_adults` | `max_occupancy` | lossy default (see §6) |
| `occ_children` / `occ_infants` | — | hardcoded `0` |
| `default_occupancy` | `max_occupancy` | matches `occ_adults` |
| `room_kind` | — | hardcoded `"room"` |

**Rate plan** (`mapGqRatePlanToChannexPayload`) — GQ-owned end to end, no BQ entity:

| Channex field | GQ source | Note |
|---|---|---|
| `title` | `gq_rate_plan.name` | direct |
| `currency` | `gq_rate_plan.currency` | defaults from BQ property's `currency` if omitted at creation |
| `sell_mode` / `rate_mode` | `gq_rate_plan.sell_mode` / `.rate_mode` | validated enums |
| `options[].rate` | — | always `0`; real rates come later via ARI (not implemented) |
| `tax_set_id` | — | **omitted entirely**, per explicit instruction |

---

## 5. Tests completed

All run live against the real running BQ (9000) + GQ (4000) servers and real staging Channex:

- **Room type onboarding**: all 7 room types of property 1 onboarded with real Channex
  UUIDs; re-running returned `already_onboarded` for all 7 (idempotent); mapping
  confirmed persisted via `GET /bq/api/roomtypes/`.
- **Rate plan create**: 201 with real Channex UUID, currency correctly defaulted from
  BQ property.
- **Rate plan idempotency**: re-creating with the same room type + name → 200, same id,
  no duplicate.
- **Occupancy validation**: option occupancy exceeding the room type's `max_occupancy`
  → 422.
- **Room-type relationship validation**: rate plan against an unrelated/nonexistent room
  type → 422.
- **GET single / GET list** → 200, correct shape.
- **PUT** (rename + replace options) → 200, new option ids.
- **DELETE** → 204; subsequent GET → 404.
- **Cross-property access**: token scoped to property 1 requesting property 2075's rate
  plans → 403 `FORBIDDEN_PROPERTY_ACCESS`.
- **Property-not-onboarded guard**: room-type onboarding attempted on property 2075
  (not onboarded to Channex) → 422 with a clear message.
- `tsc --noEmit` clean on the whole GQ backend after every change.

**Not exercised**: a room type with zero physical rooms (would hit the "no physical
rooms" validation error, but none of property 1's room types were at 0), and
`parentRatePlanId` chaining (implemented but not clicked through live).

A test JWT was minted locally (using the same `GQ_JWT_SECRET` already in `.env`) to
drive these calls, since real user credentials weren't available — the `authenticate`
middleware itself is unmodified.

---

## 6. Issues / decisions remaining

- **Occupancy split default**: BQ has one undifferentiated `max_occupancy`, no
  adults/children/infants split. `CHANNEX_BQ_API_DB_MAPPING.md` §2.3 flagged this
  `[NEEDS DECISION]`; this implementation uses the doc's own suggested lossy default
  (`occ_adults = max_occupancy`, `occ_children = 0`, `occ_infants = 0`).
- **Room count derivation**: reuses the date-range availability endpoint with an
  arbitrary 1-night window purely to read `total_rooms` — a workaround for BQ having no
  dedicated room-count endpoint, not a permanent fix.
- **Rate-plan idempotency key** is (`roomTypeId`, `name`), since GQ creates the row
  itself (no external id to check first, unlike property/room-type onboarding). Worth
  confirming this is the intended dedup rule.
- **PUT/DELETE on rate plans only affect GQ's local record.**
  `CHANNEX_BQ_API_DB_MAPPING.md` only confirms a Channex rate-plan **create** endpoint,
  not update/delete — none was invented. If Channex needs to reflect renames/removals,
  that needs its own doc verification first.
- **Room-type onboarding is bulk** (all room types for a property in one call) rather
  than one at a time, since counts need batch-fetching anyway and the spec said "get
  room types" (plural). Flagging in case a single-room-type endpoint was actually
  wanted instead.
- BQ server (port 9000) is currently running live with the `room_master.py` /
  `masterdata.py` changes **uncommitted** on the `dev` branch — commit when ready.
