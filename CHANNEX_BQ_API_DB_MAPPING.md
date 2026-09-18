# BQ ↔ Channex — API & Database Structure Mapping

Companion to `CHANNEX_INTEGRATION_ANALYSIS.md`. That document covers architecture/gaps/open questions; this one is the field-level reference: **what BQ sends/receives today, what Channex expects/returns, the exact transformation between them, and the DB tables/fields involved — per integration area.**

**Sourcing (read before using this doc):**
- **BQ side** — extracted directly from the actual route files and inline Pydantic models in `bq/backend/app/api/checkIn/routes/*.py` and `pricing-service/app/api/*.py`. No dedicated `schemas/` directory exists for these domains; models are defined inline in the route files. Quoted verbatim.
- **Channex side** — extracted directly from official docs at **docs.channex.io** (source URL cited per section). One item could not be confirmed from Channex's own docs and is flagged explicitly (§4, production base URL).
- Per `CHANNEX_INTEGRATION_ANALYSIS.md` §0.5, `eq`/`bq`/`pricing-service` share one physical Postgres DB via three independent Prisma clients — all "new field/table" changes below must be mirrored across all three `schema.prisma` files per that document's process note. This doc does not repeat that caveat per line item.
- Nothing in §1–§6 exists in BQ today except where explicitly marked "existing." Everything marked "NEW" is a proposed addition, not yet built.

---

## 1. Property

### 1.1 BQ API today
`POST /properties` (multipart/form-data — not JSON) — `bq/backend/app/api/checkIn/routes/masterdata.py`

Request (form fields): `propertyname` (≤100), `city` (≤20), `name` (≤255), `location` (≤255), `address` (≤255), `phone?` (≤15), `email?`, `logo_file?`, `homepage_file?`, `video_file?` (files).

Response (`Property` model):
```json
{
  "propertyname": "ABC Residency", "city": "Mumbai", "name": "ABC Residency Hotel",
  "location": "Andheri East", "address": "123 Main Rd", "phone": "9876543210", "email": "hotel@abc.com",
  "propertyid": 1, "logo_url": "https://.../logo.jpg", "homepage_url": null, "homepage_video_url": null,
  "created_by": 5, "checkin_time": "2026-01-01T14:00:00", "checkout_time": "2026-01-01T11:00:00",
  "created_date": "2025-01-01T00:00:00", "updated_date": "2025-06-01T00:00:00",
  "gstnumber": "27AAAAA0000A1Z5", "pan_number": "AAAAA0000A", "fssai_number": null, "cin_number": null,
  "state_code": "27", "bank_account_name": null, "bank_account_no": null, "bank_ifsc": null
}
```
`GET /properties/{property_id}`, `GET /properties`, `PUT /properties/{property_id}`, `DELETE /properties/{property_id}` follow the same shape.

### 1.2 Channex API (target)
Source: https://docs.channex.io/api-v.1-documentation/hotels-collection

`POST /api/v1/properties`

Request:
```json
{ "property": {
  "title": "Demo Hotel", "currency": "GBP", "email": "hotel@channex.io", "phone": "01267237037",
  "zip_code": "SA23 2JH", "country": "GB", "state": "Demo State", "city": "Demo Town",
  "address": "Demo Street", "timezone": "Europe/London", "property_type": "hotel"
}}
```
Response (JSON:API envelope):
```json
{ "data": [{ "type": "property", "id": "716305c4-561a-4561-a187-7f5b8aeb5920",
  "attributes": { "title": "Demo Hotel", "currency": "GBP", "email": "hotel@channex.io",
    "phone": "01267237037", "country": "GB", "timezone": "Europe/London", "property_type": "hotel" } }],
  "meta": { "limit": 10, "page": 1, "total": 1 } }
```
Rules: `title` required ≤255; `currency` required, 3-char ISO 4217; `country` 2-char ISO-3166-1; `timezone` IANA name.

### 1.3 Mapping / transformation

| Channex field | BQ source | Transform |
|---|---|---|
| `property.title` | `property.name` **[NEEDS DECISION]** | BQ has both `propertyname` (≤100, internal/brand) and `name` (≤255, display) — which one is the OTA-facing title is not self-evident from the schema; needs a product decision, not a guess |
| `property.currency` | **NONE — new field** `property.currency` | Field does not exist in BQ today; must be added and populated (see §1.4). No transform, ISO 4217 pass-through once added |
| `property.email` | `property.email` | direct |
| `property.phone` | `property.phone` | direct; Channex example is digits-only with no `+` — confirm formatting expectations before mapping |
| `property.zip_code` | **NONE — new field** | BQ `property` has no postal/zip field at all |
| `property.country` | **NONE — new field** | must be added, ISO 3166-1 alpha-2; BQ currently has no country concept on `property` |
| `property.state` | **NOT `property.state_code`** | BQ's `state_code` is an Indian GST jurisdiction code (used for tax, e.g. `"27"`), not a state/province *name* — semantically different from Channex's free-text `state`. Needs its own new field, do not reuse `state_code` |
| `property.city` | `property.city` | direct |
| `property.address` | `property.address` | direct |
| `property.timezone` | **NONE — new field** `property.time_zone` | must be added, IANA tz name |
| `property.property_type` | **NONE — new field** | must be added; likely a constant default (`"hotel"`) since BQ is single-vertical today |
| response `data[].id` (Channex property UUID) | **NONE — new field** `property.cx_property_id` | store after successful `POST /properties`; this is the anchor for every other mapping in this document |

### 1.4 BQ DB tables/fields involved

- **Existing:** `property` (`propertyid`, `propertyname`, `name`, `city`, `location`, `address`, `phone`, `email`, `state_code`, ...)
- **New fields on `property`:** `currency`, `country`, `state` (distinct from `state_code`), `zip_code`, `time_zone`, `property_type`, `cx_property_id` (unique), `cx_onboarded` (bool)

### 1.5 Channex data structure recap
`property` — `id` (UUID, PK on Channex's side), `title`, `currency`, `email`, `phone`, `zip_code`, `country`, `state`, `city`, `address`, `timezone`, `property_type`.

---

## 2. Room Type

### 2.1 BQ API today
Two inconsistent code paths exist (see `CHANNEX_INTEGRATION_ANALYSIS.md` gap notes for the simpler `masterdata.py` variant); the richer one actually used by the admin UI is below.

`POST /admin-roomtypes/` (multipart form; `roomtype_data` is a JSON-encoded string field) — `bq/backend/app/api/checkIn/routes/room_master.py`

Request (`RoomTypeCreateRequest`, JSON inside the form field):
```json
{ "propertyid": 1, "roomtypename": "Deluxe", "description": "Sea view", "baseprice": 4500.00,
  "max_occupancy": 2, "deposit_amount": 0.00, "is_refundable": true,
  "amenity_category_ids": [1,2], "roomservice_category_ids": [3] }
```
Response (`RoomTypeResponse`):
```json
{ "roomtypeid": 3, "propertyid": 1, "roomtypename": "Deluxe", "description": "Sea view",
  "baseprice": 4500.00, "max_occupancy": 2, "deposit_amount": 0.00, "is_refundable": true,
  "image_urls": ["https://.../img1.jpg"], "amenities": [{"id":1,"name":"WiFi"}],
  "service_categories": [{"id":2,"name":"Housekeeping"}] }
```

### 2.2 Channex API (target)
Source: https://docs.channex.io/api-v.1-documentation/room-types-collection

`POST /api/v1/room_types`

Request:
```json
{ "room_type": {
  "property_id": "716305c4-561a-4561-a187-7f5b8aeb5920", "title": "Standard Room",
  "count_of_rooms": 20, "occ_adults": 3, "occ_children": 0, "occ_infants": 0,
  "default_occupancy": 2, "facilities": [], "room_kind": "room", "capacity": null,
  "content": { "description": "Some Room Type Description Text", "photos": [] }
}}
```
Response mirrors the request under `data.attributes` plus an `id` (UUID). Rules: `default_occupancy` ≤ `occ_adults`; `room_kind` is `room` or `dorm` (`capacity` only applies to `dorm`).

### 2.3 Mapping / transformation

| Channex field | BQ source | Transform |
|---|---|---|
| `room_type.property_id` | `roomtype.propertyid` → `property.cx_property_id` | reverse-join to get the Channex UUID from BQ's int FK |
| `room_type.title` | `roomtype.roomtypename` | direct |
| `room_type.count_of_rooms` | `COUNT(room WHERE roomtypeid = X)` | **not a stored field today** — must be computed via aggregate query at push time, or cached into a new `roomtype.room_count` column kept in sync on room create/delete |
| `room_type.occ_adults` / `occ_children` / `occ_infants` | `roomtype.max_occupancy` **[LOSSY]** | BQ stores one undifferentiated `max_occupancy` int; Channex wants adults/children/infants split separately. No BQ source distinguishes these. **[NEEDS DECISION]**: either add 3 new fields to `roomtype` and require them to be filled in during onboarding, or default `occ_adults = max_occupancy`, `occ_children = 0`, `occ_infants = 0` as a lossy but workable default |
| `room_type.default_occupancy` | **NONE — new field** or derived from `max_occupancy` | must be ≤ `occ_adults` per Channex validation |
| `room_type.content.description` | `roomtype.description` | direct |
| `room_type.content.photos` | `roomtype_images` (existing model) | need to confirm Channex's expected photo object shape (url only vs. url+metadata) — **[NEEDS VERIFICATION]**, not confirmed in the docs page fetched |
| `room_type.room_kind` | **NONE — new field** | default `"room"` (BQ has no dorm/hostel bed concept today) |
| response `id` | **NONE — new field** `roomtype.cx_room_type_id` | store after creation |

### 2.4 BQ DB tables/fields involved

- **Existing:** `roomtype` (`roomtypeid`, `propertyid`, `roomtypename`, `description`, `baseprice`, `max_occupancy`, `deposit_amount`, `is_refundable`), `room` (for live room-count aggregation), `roomtype_images`
- **New fields on `roomtype`:** `cx_room_type_id` (unique), `cx_title`, `room_kind` (default `"room"`), and — pending the §2.3 occupancy decision — either `occ_adults`/`occ_children`/`occ_infants`/`default_occupancy`, or none (reuse `max_occupancy` with lossy defaulting)

### 2.5 Channex data structure recap
`room_type` — `id` (UUID), `property_id`, `title`, `count_of_rooms`, `occ_adults`, `occ_children`, `occ_infants`, `default_occupancy`, `facilities[]`, `room_kind`, `capacity`, `content.description`, `content.photos[]`.

---

## 3. Rate Plans / Pricing

### 3.1 BQ API today
**No rate-plan concept or API exists in BQ at all.** The closest analogs:
- `roomtype.baseprice` (Decimal, major units) — flat per-room-type base price.
- `pricing-service` `GET /dynamic-prices-calendar?start_date=&end_date=&room_type=` — itemized per-date price:
```json
{ "status": "success", "date_range": {"start":"2026-01-01","end":"2026-01-07","total_days":7},
  "room_types": [{ "roomtypename": "Deluxe", "prices": [
    {"date":"2026-01-01","roomtypename":"Deluxe","baseprice":4500.0,"dynamicprice":5200.0,"template_applied":"Weekend Surge","has_dynamic_pricing":true},
    {"date":"2026-01-02","roomtypename":"Deluxe","baseprice":4500.0,"dynamicprice":null,"template_applied":null,"has_dynamic_pricing":false}
  ]}] }
```
This is **room-type-scoped, not rate-plan-scoped** — BQ has no notion of multiple sellable rate plans per room type (e.g. "Non-refundable", "Breakfast included"). All prices are **float, major currency units** (e.g. `4500.0`), never minor units.

### 3.2 Channex API (target)
Source: https://docs.channex.io/api-v.1-documentation/rate-plans-collection

`POST /api/v1/rate_plans`

Request:
```json
{ "rate_plan": {
  "title": "Best Available Rate", "property_id": "716305c4-561a-4561-a187-7f5b8aeb5920",
  "room_type_id": "994d1375-dbbd-4072-8724-b2ab32ce781b", "tax_set_id": "4adfa81f-af0a-4b39-834f-1336ab065c08",
  "parent_rate_plan_id": null, "currency": "GBP", "sell_mode": "per_room", "rate_mode": "manual",
  "children_fee": "0.00", "infant_fee": "0.00",
  "options": [{ "occupancy": 3, "is_primary": true, "rate": 0 }]
}}
```
**Important documented behavior:** a newly-created rate plan defaults to **rate = 0, stop sell = off, min stay = 1** — creating it does *not* set real prices; real values must be pushed afterward via the ARI restrictions endpoint (§4).

### 3.3 Mapping / transformation

| Channex field | BQ source | Transform |
|---|---|---|
| `rate_plan.title` | **NONE — new field** `rate_plan.name` | BQ has no rate-plan table at all yet — this entire entity is net new (see §7 of `CHANNEX_INTEGRATION_ANALYSIS.md`) |
| `rate_plan.property_id` | via `roomtype.propertyid` → `property.cx_property_id` | reverse-join |
| `rate_plan.room_type_id` | via new `rate_plan.room_type_id` → `roomtype.cx_room_type_id` | reverse-join |
| `rate_plan.currency` | `property.currency` (new field, §1) | default from parent property unless overridden |
| `rate_plan.sell_mode` | **NONE — new field** `rate_plan.sell_mode` | default `"per_room"`; no BQ equivalent exists today |
| `rate_plan.options[].rate` | **initial value only — set to 0 or `roomtype.baseprice`** | actual day-to-day rates are **not** set at creation time; they flow through the ARI push (§4), not this call |
| response `id` | **NONE — new field** `rate_plan.cx_rate_plan_id` | store after creation |

### 3.4 BQ DB tables/fields involved

- **Existing (read-only source for seeding a default rate plan):** `roomtype.baseprice`, `dynamicprice`, `pricing-service`'s calendar output
- **New table `rate_plan`** (fully new — see `CHANNEX_INTEGRATION_ANALYSIS.md` §5.2 for full field list): `id`, `property_id`, `room_type_id` (one room type → many rate plans), `name`, `sell_mode`, `occupancy`, `currency`, `is_default`, `cx_rate_plan_id`, `cx_title`

### 3.5 Channex data structure recap
`rate_plan` — `id` (UUID), `title`, `property_id`, `room_type_id`, `tax_set_id`, `parent_rate_plan_id`, `currency`, `sell_mode` (`per_room`|`per_person`), `rate_mode` (`manual`|`derived`|`auto`|`cascade`), `children_fee`, `infant_fee`, `options[]` (`occupancy`, `is_primary`, `rate`).

---

## 4. ARI — Availability, Rates & Restrictions

This is the recurring sync operation (not a one-time onboarding call like §1–§3) — it's what runs on the batching/scheduling cadence described in `CHANNEX_INTEGRATION_ANALYSIS.md` §2.6/§9.4.

### 4.1 Availability

**BQ API today** — closest existing source, but shape mismatch: `GET /bq/api/availability/check-dates/all?checkin=&checkout=&property_id=` (`bq/backend/app/api/checkIn/routes/room.py`) returns **one aggregate count for the entire requested range**, not itemized per day:
```json
{ "checkin": "2026-02-01", "checkout": "2026-02-05", "room_types": [
  { "room_type": "Deluxe", "roomtypeid": 3, "baseprice": 4500.0, "status": "AVAILABLE",
    "total_rooms": 10, "booked_rooms": 3, "available_rooms": 7 } ] }
```
Availability is **always computed live** from `room.status` + overlapping `booking` rows — no persisted per-date count exists anywhere.

**Channex API (target).** Source: https://docs.channex.io/api-v.1-documentation/ari

`POST /api/v1/availability`
```json
{ "values": [{ "property_id": "716305c4-561a-4561-a187-7f5b8aeb5920",
  "room_type_id": "bab451e7-9ab1-4cc4-aa16-107bf7bbabb2", "date": "2019-02-20", "availability": 2 }] }
```
Response (async — returns a task, not immediate confirmation):
```json
{ "data": [{ "id": "eb31d631-4fcc-478a-80c3-bf7a2acf0699", "type": "task" }], "meta": { "message": "Success", "warnings": [] } }
```
Also accepts `date_from`/`date_to` + optional `days` (weekday codes) instead of a single `date`.

**Mapping / transformation**

| Channex field | BQ source | Transform |
|---|---|---|
| `values[].property_id` | `property.cx_property_id` | direct lookup |
| `values[].room_type_id` | `roomtype.cx_room_type_id` | direct lookup |
| `values[].date` | **per-day loop** | **Gap:** `check-dates/all` returns one number for a whole range; Channex needs one entry **per date**. Requires either (a) a new internal function that loops day-by-day re-running the existing availability computation, or (b) the persisted snapshot table option from `CHANNEX_INTEGRATION_ANALYSIS.md` §5.4 — this decision is unresolved there and applies directly here |
| `values[].availability` | `available_rooms` (per day, per room type) | direct once itemized per day |

### 4.2 Rates & Restrictions

**BQ API today** — rates: `GET /dynamic-prices-calendar` (§3.1) gives per-date `dynamicprice`/`baseprice` in **major units, float**. Restrictions (min stay, max stay, CTA, CTD, stop sell): **do not exist anywhere in BQ** — there is no concept of these at all, not even a placeholder field.

**Channex API (target).** Same source as §4.1.

`POST /api/v1/restrictions`
```json
{ "values": [{ "property_id": "716305c4-561a-4561-a187-7f5b8aeb5920",
  "rate_plan_id": "bab451e7-9ab1-4cc4-aa16-107bf7bbabb2", "date": "2019-02-20", "rate": 30000 }] }
```
Also accepts, per entry (all optional, at least one restriction field required if `rate` is omitted): `rates` (array, for multi-occupancy rate plans), `min_stay_arrival`, `min_stay_through`, `min_stay`, `max_stay`, `closed_to_arrival`, `closed_to_departure`, `stop_sell`.

Response shape identical to §4.1 (task id + `meta.warnings[]`).

**Rate limits (confirmed from docs, more precise than the mock's estimate in the companion doc):** 20 ARI requests/min total per account, split as **10 Availability/min/property** and **10 Restrictions & Price requests/min/property**; max 10 MB per call; over-limit → `429` (`http_too_many_requests`).

**Mapping / transformation**

| Channex field | BQ source | Transform |
|---|---|---|
| `values[].property_id` | `property.cx_property_id` | direct lookup |
| `values[].rate_plan_id` | `rate_plan.cx_rate_plan_id` (new table, §3) | direct lookup |
| `values[].date` | per-date from `dynamic-prices-calendar` | direct, already itemized per day |
| `values[].rate` | `dynamicprice.dynamicprice` (fallback `roomtype.baseprice`), **major units float** | **must convert to integer minor units** — e.g. `round(price * 100)` for 2-decimal currencies like INR; confirm decimal-place rule per currency before implementing, since Channex's doc phrasing ("integer with minimum fraction size of currency") implies this varies by currency |
| `values[].min_stay_arrival` / `min_stay_through` / `max_stay` / `closed_to_arrival` / `closed_to_departure` / `stop_sell` | **NONE — no BQ source at all** | These fields have **no existing BQ data to transform from.** They must be authored net-new (see `rate_restriction` table, `CHANNEX_INTEGRATION_ANALYSIS.md` §5.2) via a new admin UI — this is not a mapping problem, it's a net-new data-entry requirement |

### 4.3 BQ DB tables/fields involved
- **Existing (read source):** `room`, `booking` (for live availability computation), `dynamicprice`, `roomtype.baseprice` (for rates)
- **New:** `rate_plan` (§3.4), `rate_restriction` (new table — no existing BQ analog), `channex_push_task` (audit of each push + its task id/status/warnings), `channex_api_log` (every outbound call, method/endpoint/http_status/latency)

### 4.4 Channex data structure recap
Availability value: `property_id`, `room_type_id`, `date`(s), `availability` (int). Restriction value: `property_id`, `rate_plan_id`, `date`(s), `rate` (int, minor units), `min_stay_arrival`, `min_stay_through`, `min_stay`, `max_stay`, `closed_to_arrival`, `closed_to_departure`, `stop_sell`.

---

## 5. Reservations / Bookings

**Direction is reversed from §1–§4** — this flow is Channex → BQ, not BQ → Channex. BQ never creates a booking on Channex; it only reads Channex's booking feed, persists the reservation, and acknowledges it back.

### 5.1 Channex API (source of the data)
Source: https://docs.channex.io/api-v.1-documentation/bookings-collection

`GET /api/v1/booking_revisions/feed`
```json
{ "meta": {"total":1,"page":1,"limit":10}, "data": [{
  "type": "booking_revision", "id": "03dd7198-c5b7-493c-a889-74d0c2211de7",
  "attributes": {
    "id": "03dd7198-c5b7-493c-a889-74d0c2211de7", "property_id": "716305c4-561a-4561-a187-7f5b8aeb5920",
    "booking_id": "cfa33f3b-bd32-4b90-8ef9-bde2bfe986cd", "unique_id": "BDC-9996013801",
    "system_id": "12331233123", "ota_reservation_code": "9996013801", "ota_name": "Booking.com",
    "status": "new", "arrival_date": "2019-04-26", "departure_date": "2019-04-27",
    "amount": "220.00", "currency": "GBP",
    "rooms": [{ "amount": "200.00", "checkin_date": "2019-04-26", "checkout_date": "2019-04-27",
      "rate_plan_id": "445835fb-7956-42ac-9efc-3e6f331f0808", "room_type_id": "994d1375-dbbd-4072-8724-b2ab32ce781b",
      "ota_unique_id": "49", "occupancy": {"adults":2,"children":0,"infants":0},
      "guests": [{"name":"Guest Name","surname":"Guest Surname"}] }],
    "inserted_at": "2019-04-23T10:03:29.335485"
} }] }
```
`POST /api/v1/booking_revisions/:id/ack` → `{ "meta": { "message": "Success" } }`. Errors: `401` (bad key), `404` (unknown revision id). Operational rule: unacknowledged revisions are re-served in the feed for **30 minutes**, after which Channex emails a warning. **Note:** the docs page did not enumerate a full `status` value list beyond the `"new"` example — modified/cancelled values are assumed by naming convention but **not explicitly confirmed**. **[NEEDS VERIFICATION]** against the separate Booking CRS API page (`docs.channex.io/api-v.1-documentation/booking-crs-api`), not fetched in this pass.

### 5.2 BQ API today (nearest existing analog — not a fit as-is)
`POST /create-reservation-walkin-new/` / `POST /create-reservation-online-new/` (`bq/backend/app/api/checkIn/routes/booking.py`) — body `{guest: Guest, booking: Booking}`, where `Booking.room_type` is matched **by name string, case-insensitive**, and pricing is **computed live by the pricing engine**, not supplied by the caller. Response includes a full computed `billing` breakdown.

**This endpoint is not directly reusable for Channex-sourced bookings** — a Channex booking already carries its own OTA-quoted `amount`, which must be persisted as-is, not recalculated by BQ's dynamic-pricing engine. A new or adapted creation path is required.

`GET /bookings/` response shape (existing):
```json
{ "bookings": [{ "bookingid":"BK...", "orderid":"OR...", "guestid":"...", "firstname":"...", "lastname":"...",
  "roomid":12, "roomnumber":205, "checkindate":"2026-02-01", "checkoutdate":"2026-02-03",
  "roomtypename":"Deluxe", "booking_status":"Soft", "booking_type":"Walkin" }] }
```
`booking_status` is free text (`Soft`/`Hard`/`Checkedout`/`Cancelled` observed in code).

### 5.3 Mapping / transformation (Channex → BQ)

| Channex field | BQ target | Transform |
|---|---|---|
| `attributes.id` (revision id) | **NONE — new field** `channex_booking_revision.cx_revision_id` | direct |
| `attributes.booking_id` (Channex's stable booking id) | **NONE — new field** `channex_booking_revision.cx_booking_id` | direct — this stays constant across revisions, unlike `id` |
| `attributes.property_id` | reverse lookup `property.cx_property_id` → `property.propertyid` | reverse ID mapping |
| `attributes.unique_id` / `ota_reservation_code` | **NONE — new field** `channex_booking_revision.ota_reference` | direct |
| `attributes.ota_name` | **NONE — new field/table** `channel` (see `CHANNEX_INTEGRATION_ANALYSIS.md` §5.2) or free-text column | needs a decision: structured `channel` FK vs. plain string |
| `attributes.status` (`new`/presumed `modified`/`cancelled`) | `booking.booking_status` (`Soft`/`Hard`/`Checkedout`/`Cancelled`) **[VOCABULARY MISMATCH]** | the two enums don't correspond 1:1; needs an explicit transform table (e.g. `new`→create as `Soft` or `Hard`?, `cancelled`→set `Cancelled`) as a product decision, not inferred here. Recommend tracking Channex's own `status` independently on `channex_booking_revision.status` rather than forcing it into `booking.booking_status`'s existing vocabulary |
| `attributes.arrival_date` / `departure_date` | `booking.checkindate` / `checkoutdate` | direct copy, **but** these BQ columns are typed `String?`, not `Date` — pre-existing data-quality risk flagged in the companion doc, applies directly here |
| `attributes.amount` / `currency` | new booking's billing record — **must bypass dynamic pricing recalculation** | BQ's existing creation flow always computes price via the pricing engine; a Channex booking must store the OTA-quoted `amount` as the authoritative charge instead |
| `rooms[].room_type_id` / `rate_plan_id` (Channex UUIDs) | reverse lookup via `roomtype.cx_room_type_id` / `rate_plan.cx_rate_plan_id` → BQ `roomtypeid` | **if no match exists, block** — this is the "Unmapped Room" error case from the companion doc; must not silently fail |
| `rooms[].occupancy.adults/children/infants` | `booking.numberofguests` (single int) **[LOSSY]** | BQ has no adult/child/infant split on a booking; either sum into one field (lossy) or add new columns |
| `rooms[].guests[].name/surname` | `guest.firstname` / `guest.lastname` | direct, but likely requires **creating a new `guest` row**, since Channex guests are not pre-existing BQ guests |
| `attributes.inserted_at` | **NONE — new field** `channex_booking_revision.received_at` | direct |

Then, after BQ confirms durable storage: **`POST /booking_revisions/:id/ack`** — no meaningful request body beyond the path id. BQ-side precondition: query the booking by its composite key to confirm it exists before calling this (ties to the `GET /channex/bookings/{order_id}/{booking_id}` endpoint proposed in `CHANNEX_INTEGRATION_ANALYSIS.md` §7).

### 5.4 BQ DB tables/fields involved
- **Existing (write target, via an adapted/new creation path):** `booking`, `booking_guest`, `guest`, `billing`/`invoice` (populated with the OTA-quoted amount, not pricing-engine output)
- **New table `channex_booking_revision`** (full field list in the companion doc §5.2): `id`, `order_id`/`booking_id` (FK to `booking`'s composite key), `cx_revision_id`, `cx_booking_id`, `ota_code`, `channel_id`, `status`, `guest_name`, `amount_minor_units`, `arrival_date`, `departure_date`, `received_at`, `acked_at`, `ack_status`, `blocking_reason`

### 5.5 Channex data structure recap
`booking_revision` — `id`, `property_id`, `booking_id`, `unique_id`, `system_id`, `ota_reservation_code`, `ota_name`, `status`, `arrival_date`, `departure_date`, `amount`, `currency`, `rooms[]` (`amount`, `checkin_date`, `checkout_date`, `rate_plan_id`, `room_type_id`, `ota_unique_id`, `occupancy{adults,children,infants}`, `guests[]{name,surname}`), `inserted_at`.

---

## 6. Webhooks (supporting infrastructure — the "other required" API)

Required because polling `booking_revisions/feed` alone is explicitly described as a fallback, not the primary delivery mechanism, per the companion doc §2.5.

Source: https://docs.channex.io/api-v.1-documentation/webhook-collection

**Registration:** `POST /api/v1/webhooks`
```json
{ "webhook": { "callback_url": "https://your-website.com/api/push_message", "event_mask": "*",
  "property_id": "property-uuid-or-null", "is_global": false, "request_params": {},
  "headers": { "X-Channex-Webhook-Secret": "your-secret" }, "is_active": true, "send_data": true } }
```

**Delivery envelope (booking event):**
```json
{ "event": "booking", "payload": { "booking_id": "...", "property_id": "...", "revision_id": "..." },
  "property_id": "...", "user_id": null, "timestamp": "2021-12-24T00:00:00.0000Z" }
```
**Delivery envelope (ARI event):**
```json
{ "event": "ari", "payload": [{ "availability": 5, "booked": 7, "date": "2021-12-02",
  "rate_plan_id": "...", "room_type_id": "...", "stop_sell": false }],
  "property_id": "...", "user_id": null, "timestamp": "..." }
```
If `send_data: false`, only the envelope is sent (no `payload`) — the receiver must then call the feed/read APIs to fetch the actual data, i.e. **webhooks should be treated as "something changed, go re-fetch" triggers, not authoritative payloads**, per Channex's own docs. Retries: exponential backoff, up to 11 attempts over ~24h on 5xx responses.

**Authenticity — important finding:** Channex has **no HMAC/cryptographic signature scheme** (unlike Stripe/GitHub-style webhooks). Authenticity relies on: (a) HTTPS-only callback URL, (b) a developer-defined custom header/secret configured at registration time (e.g. `X-Channex-Webhook-Secret`) that Channex echoes back on every call for the receiver to validate, and (c) optional IP allowlisting. This must inform the webhook-receiver implementation — signature verification logic should validate the custom header, not attempt an HMAC scheme that doesn't exist.

### DB tables/fields involved
New tables (from companion doc §5.2): `channex_webhook_log` (event, ref, attempt, http_status_returned, received_at, next_retry_at), `channex_account_config` (stores `webhook_url`, `webhook_secret`, `api_key`, `environment`).

---

## 7. Consolidated ID-mapping reference

| BQ entity/field | Channex entity/field | Relationship |
|---|---|---|
| `property.propertyid` (Int) | `property.cx_property_id` (UUID) | 1:1, stored on `property` |
| `roomtype.roomtypeid` (Int) | `roomtype.cx_room_type_id` (UUID) | 1:1, stored on `roomtype` |
| `rate_plan.id` (new table, Int) | `rate_plan.cx_rate_plan_id` (UUID) | 1:1, stored on new `rate_plan` table |
| `booking` composite key (`orderid`,`bookingid`) | `booking_revision.booking_id` + `.id` (revision) | **1:many** — one BQ booking can have multiple Channex revisions over its lifecycle; modeled as child table `channex_booking_revision`, not a flattened column |

This mirrors the strategy already settled in `CHANNEX_INTEGRATION_ANALYSIS.md` §8 (flattened 1:1 fields for property/room-type/rate-plan; a dedicated child table for bookings because of the 1:many cardinality).

## 8. Consolidated new-field/table summary

| Table | New fields | New table? |
|---|---|---|
| `property` | `currency`, `country`, `state`, `zip_code`, `time_zone`, `property_type`, `cx_property_id`, `cx_onboarded` | no (modify existing) |
| `roomtype` | `cx_room_type_id`, `cx_title`, `room_kind`, + occupancy-split fields (pending §2.3 decision) | no (modify existing) |
| `rate_plan` | full new table | **yes** |
| `rate_restriction` | full new table | **yes** |
| `channel` | full new table | **yes** |
| `channex_booking_revision` | full new table | **yes** |
| `channex_push_task` | full new table | **yes** |
| `channex_api_log` | full new table | **yes** |
| `channex_webhook_log` | full new table | **yes** |
| `channex_error_queue` | full new table | **yes** |
| `channex_account_config` | full new table | **yes** |

(Full per-table field lists already specified in `CHANNEX_INTEGRATION_ANALYSIS.md` §5.2 — not repeated here to avoid drift between two documents; treat that section as the canonical field list.)

---

## 9. Open items requiring verification

1. Whether Channex's `property.title` should map from BQ `property.name` or `property.propertyname` — the two fields overlap in purpose and neither is a clean fit by name alone. (§1.3)
2. Channex's expected `room_type.content.photos` object shape — not confirmed from the docs page fetched. (§2.3)
3. Whether to add explicit `occ_adults`/`occ_children`/`occ_infants` fields to `roomtype`, or accept a lossy default from the single existing `max_occupancy`. (§2.3)
4. Exact minor-unit conversion rule per currency for the `rate` field (confirmed to be currency-dependent per Channex's own phrasing, not a flat ×100 for every currency). (§4.2)
5. Full enumerated list of `booking_revision.status` values (only `"new"` confirmed from the fetched docs page) — needed to build the `status` → `booking.booking_status` transform table. (§5.1, §5.3)
6. Whether `channex_booking_revision.channel_id` should be a structured FK to a new `channel` table or a plain string — affects whether the `channel` table proposed in the companion doc is required for MVP or can be deferred. (§5.3)
7. Channex's production base URL was not confirmed from Channex's own documentation during this research pass (only the staging URL `https://staging.channex.io/api/v1` was confirmed) — verify directly with Channex before relying on any production URL value. (Carried over from prior research; relevant to every `POST`/`GET` call in this document.)
