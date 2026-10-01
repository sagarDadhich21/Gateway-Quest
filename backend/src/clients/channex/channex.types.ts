/**
 * Types for the Channex.io Properties API, sourced from docs.channex.io
 * (see CHANNEX_BQ_API_DB_MAPPING.md section 1.2 for the confirmed request/response
 * shapes and source URL). Only the property-creation shape is modeled here - this
 * phase only implements property onboarding.
 */
 
export interface ChannexPropertyCreateRequest {
  property: {
    title: string;
    currency: string;
    email?: string;
    phone?: string;
    zip_code?: string;
    country: string;
    state?: string;
    city: string;
    address: string;
    timezone: string;
    property_type?: string;
  };
}
 
export interface ChannexPropertyAttributes {
  title: string;
  currency: string;
  email?: string;
  phone?: string;
  country: string;
  timezone: string;
  property_type?: string;
}
 
export interface ChannexWarning {
  [field: string]: unknown;
}
 
/**
 * Channex's documented response envelope wraps a single created property inside a
 * `data` array (confirmed from docs.channex.io, not assumed) and carries any row-level
 * problems under `meta.warnings` even on an HTTP 200 - callers must check this array
 * before treating the call as a success.
 */
export interface ChannexPropertyCreateResponse {
  data: Array<{
    type: "property";
    id: string;
    attributes: ChannexPropertyAttributes;
  }> | {
    type: "property";
    id: string;
    attributes: ChannexPropertyAttributes;
  };
  meta?: {
    message?: string;
    warnings?: ChannexWarning[];
  };
}

/**
 * Types for the Channex.io Room Types API, sourced from docs.channex.io
 * (see CHANNEX_BQ_API_DB_MAPPING.md section 2.2 for the confirmed request/response
 * shapes). Only room-type creation is modeled here - this phase does not implement
 * updates/deletes on the Channex side.
 */
export interface ChannexRoomTypeCreateRequest {
  room_type: {
    property_id: string;
    title: string;
    count_of_rooms: number;
    occ_adults: number;
    occ_children?: number;
    occ_infants?: number;
    default_occupancy?: number;
    room_kind?: "room" | "dorm";
    capacity?: number | null;
    facilities?: string[];
    content?: {
      description?: string;
      photos?: unknown[];
    };
  };
}

export interface ChannexRoomTypeAttributes {
  title: string;
  property_id: string;
  count_of_rooms: number;
  occ_adults: number;
  occ_children: number;
  occ_infants: number;
  default_occupancy: number;
  room_kind: string;
}

export interface ChannexRoomTypeCreateResponse {
  data: Array<{
    type: "room_type";
    id: string;
    attributes: ChannexRoomTypeAttributes;
  }> | {
    type: "room_type";
    id: string;
    attributes: ChannexRoomTypeAttributes;
  };
  meta?: {
    message?: string;
    warnings?: ChannexWarning[];
  };
}

/**
 * Types for the Channex.io Rate Plans API, sourced from docs.channex.io
 * (see CHANNEX_BQ_API_DB_MAPPING.md section 3.2). `tax_set_id` is deliberately not
 * modeled/sent per this phase's explicit scope - real rates are pushed later via ARI,
 * not implemented here either.
 */
export interface ChannexRatePlanCreateRequest {
  rate_plan: {
    title: string;
    property_id: string;
    room_type_id: string;
    parent_rate_plan_id?: string | null;
    currency: string;
    sell_mode: "per_room" | "per_person";
    rate_mode: "manual" | "derived" | "auto" | "cascade";
    children_fee?: string;
    infant_fee?: string;
    options: Array<{ occupancy: number; is_primary: boolean; rate: number }>;
  };
}

export interface ChannexRatePlanAttributes {
  title: string;
  property_id: string;
  room_type_id: string;
  currency: string;
  sell_mode: string;
  rate_mode: string;
}

export interface ChannexRatePlanCreateResponse {
  data: Array<{
    type: "rate_plan";
    id: string;
    attributes: ChannexRatePlanAttributes;
  }> | {
    type: "rate_plan";
    id: string;
    attributes: ChannexRatePlanAttributes;
  };
  meta?: {
    message?: string;
    warnings?: ChannexWarning[];
  };
}

/**
 * Types for the Channex.io ARI (Availability, Rates & Restrictions) API, sourced from
 * docs.channex.io (see CHANNEX_BQ_API_DB_MAPPING.md section 4.1/4.2). Confirmed as two
 * separate endpoints, never combined in one call - availability is room-type scoped,
 * rates/restrictions are rate-plan scoped. Both return a `task` (async processing), not
 * the pushed values themselves - and both can carry row-level failures under
 * `meta.warnings` on an HTTP 200, exactly like property/room-type/rate-plan creation.
 */
export interface ChannexAvailabilityValue {
  property_id: string;
  room_type_id: string;
  date: string; // YYYY-MM-DD
  availability: number;
}

export interface ChannexAvailabilityPushRequest {
  values: ChannexAvailabilityValue[];
}

/**
 * `min_stay` is deliberately not modeled here - confirmed via a real CHANNEX_WARNINGS
 * response that Channex rejects it on properties not configured for that restriction
 * type ("please use `min_stay_through` or `min_stay_arrival`"), so ari.service.ts never
 * sends it - see pushRestrictions' min_stay_arrival/min_stay_through fallback.
 */
export interface ChannexRestrictionValue {
  property_id: string;
  rate_plan_id: string;
  date: string; // YYYY-MM-DD
  rate?: number; // integer, minor currency units
  min_stay_arrival?: number;
  min_stay_through?: number;
  max_stay?: number;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  stop_sell?: boolean;
}

export interface ChannexRestrictionsPushRequest {
  values: ChannexRestrictionValue[];
}

export interface ChannexAriPushResponse {
  data: Array<{ type: "task"; id: string }>;
  meta?: {
    message?: string;
    warnings?: ChannexWarning[];
  };
}

/**
 * Response shapes for Channex's read-back endpoints (GET /api/v1/availability,
 * GET /api/v1/restrictions - docs.channex.io, "Availability and Rates"). There is no
 * documented endpoint to poll an ARI push's task by id, so this is how GQ confirms a
 * push actually landed: read the value straight back right after pushing it, rather
 * than trusting the task id alone.
 */
export interface ChannexAvailabilityReadResponse {
  /** room_type_id -> date (YYYY-MM-DD) -> availability count. */
  data: Record<string, Record<string, number>>;
}

/** rate_plan_id -> date (YYYY-MM-DD) -> restriction field name -> value. */
export interface ChannexRestrictionsReadResponse {
  data: Record<string, Record<string, Record<string, string | number | boolean>>>;
}

/**
 * Types for the Channex.io Channel API (docs.channex.io/api-v.1-documentation/
 * channel-api) and one-time-token/IFrame endpoint (docs.channex.io/api-v.1-
 * documentation/channel-iframe) - reconciled against real live responses from Channex
 * staging (not just the docs page), since the docs summary turned out to be wrong
 * about the activate/deactivate response shape (see ChannexChannelActionResponse).
 *
 * Channex has no REST API to create/update/remove a room-type/rate-plan mapping - that
 * only happens through the hosted IFrame "mapping screen" a one-time token unlocks.
 *
 * `relationships.known_mappings` is a REAL field but confirmed EMPTY on a live channel
 * that genuinely has real, working room/rate mappings configured through the mapping
 * screen (2026-09-28) - it is not a reliable source, at least not for mappings made the
 * way Channex's current mapping UI writes them. The actual, confirmed-live source of
 * truth is `attributes.settings.mappingSettings.rooms` (OTA room code -> GQ room_type_id)
 * joined with `attributes.rate_plans` (each entry carries its own OTA room/rate codes in
 * `settings` plus the resolved `rate_plan_id` directly) - see
 * listAndSyncMappings()/channel.service.ts for the join logic. `ChannexKnownMapping`/
 * `relationships.known_mappings` is kept here only because it's a real field that may
 * still be populated for other mapping methods - do not depend on it alone.
 */
export interface ChannexKnownMapping {
  id: string;
  type: "auto" | "manual";
  rate_plan_code: string | null;
  room_type_code: string | null;
  rate_plan_id: string | null;
  room_type_id: string | null;
}

export interface ChannexChannelRatePlanEntry {
  id: string;
  settings: {
    room_type_code: number | string;
    rate_plan_code: number | string;
    occupancy?: number;
    primary_occ?: boolean;
    [key: string]: unknown;
  };
  rate_plan_id: string;
}

/**
 * There is no `status` field anywhere in Channex's real channel payload (confirmed live
 * against GET /channels and GET /channels/{id} on staging) - only `is_active`, despite
 * the docs summary implying one. Not modeled here.
 */
export interface ChannexChannelAttributes {
  title: string;
  channel: string;
  currency: string | null;
  is_active: boolean;
  properties: string[];
  settings?: {
    mappingSettings?: {
      // OTA room_type_code (as a string key, even though it's numeric) -> GQ room_type_id.
      rooms?: Record<string, string>;
    };
  };
  rate_plans?: ChannexChannelRatePlanEntry[];
}

export interface ChannexChannelListResponse {
  data: Array<{
    type: "channel";
    id: string;
    attributes: ChannexChannelAttributes;
  }>;
  meta?: { page?: number; limit?: number; total?: number };
}

export interface ChannexChannelDetailResponse {
  data: {
    type: "channel";
    id: string;
    attributes: ChannexChannelAttributes;
    relationships?: {
      known_mappings?: {
        data: Array<{ id: string; type: "known_mapping"; attributes: ChannexKnownMapping }>;
      };
    };
  };
}

/**
 * POST /channels/{id}/activate and /deactivate do NOT return the updated channel
 * resource, despite docs.channex.io's summary saying "same structure as retrieve" -
 * confirmed live: the real response is just `{"meta":{"message":"Success"}}`, no
 * `data` at all. Callers must not read `.data` off this - see channel.service.ts's
 * activateChannel/deactivateChannel, which set local state from the known outcome
 * instead of a resource this response never provides.
 */
export interface ChannexChannelActionResponse {
  meta?: { message?: string };
}

export interface ChannexOneTimeTokenRequest {
  property_id: string;
  username: string;
  group_id?: string;
}

export interface ChannexOneTimeTokenResponse {
  data: { token: string };
  meta?: { message?: string };
}

/**
 * Types for Channex's Booking Revision Feed and single-booking read (docs.channex.io/
 * api-v.1-documentation/bookings-collection). A webhook payload only ever carries
 * {event, payload:{booking_id, property_id, revision_id}} - the actual reservation
 * content (rooms, rates, amount, guests) only ever comes from these two endpoints,
 * never the webhook body itself.
 *
 * Re-confirmed against a REAL live revision feed response (2026-09-25, staging, 3 real
 * Booking.com test reservations) - two things the docs/earlier research got wrong:
 * - There is no `revision_id` field on a revision's attributes at all. The revision's
 *   own identifier - what `booking_revisions/:id` and `POST .../ack` both key off - is
 *   just `id` (same value as the feed entry's own top-level `id`). Every call into
 *   processRevision() against real data crashed on this (`cx_revision_id: undefined`)
 *   until this fix - synthetic test data (scripts/simulate-booking-revision.ts) had
 *   masked it by supplying its own `revision_id`, which the real API never sends.
 * - `amount` (both here and on each room) is a numeric STRING (e.g. "181.15"), not a
 *   number - do not do arithmetic on it without an explicit Number()/toMinorUnits()
 *   conversion (src/lib/currency.ts), or currencies with different real minor-unit
 *   sizes (e.g. 0-decimal JPY) will be stored 100x too large.
 * - `room_type_id`/`rate_plan_id` can be `null` - confirmed on a real "Unmapped Rate"
 *   Channex-side booking (Channex's own dashboard flags these with a red "Unmapped
 *   Rate"/"Unmapped Room" badge and an "unresolved issue" banner). resolveRoomGroups()
 *   below must treat a null id as immediately unresolved rather than passing it to
 *   findRatePlanByCxId()/room-type lookup - Prisma's findUnique() throws outright on a
 *   literal `null` for a unique column, it does not return "not found".
 */
export interface ChannexBookingRevisionRoom {
  room_type_id: string | null;
  rate_plan_id: string | null;
  checkin_date: string;
  checkout_date: string;
  amount: string;
  occupancy?: { adults?: number; children?: number; infants?: number };
  guests?: Array<{ name?: string; surname?: string }>;
}

export interface ChannexBookingRevisionAttributes {
  // On a revision-feed entry (GET /booking_revisions/feed), `id` genuinely IS the
  // revision's own identifier - confirmed live. On a single-booking read
  // (GET /bookings/:id), `id` is actually the BOOKING's id instead, and the real
  // revision id lives in the separate `revision_id` field below - confirmed live
  // 2026-10-01 after this exact mismatch made every webhook-triggered ack 404
  // ("resource_not_found") even though the underlying BQ booking was created
  // successfully. getChannexBooking() (channex.client.ts) normalizes this - by the
  // time callers see this type, `id` is always the true revision id either way; do not
  // read `revision_id` directly outside that one normalization step.
  id: string;
  revision_id?: string;
  property_id: string;
  booking_id: string;
  ota_reservation_code: string | null;
  status: "new" | "modified" | "cancelled";
  rooms: ChannexBookingRevisionRoom[];
  // `name`/`surname` are separate fields on the real API (first/last name) - do not
  // treat `name` alone as a full name. Confirmed missed originally: guest_name was
  // stored as `customer.name` alone (first name only), and the BQ guest record's
  // lastname was built by splitting that single first-name string, discarding the
  // guest's real surname entirely - see resolveGuestName() in booking.service.ts.
  customer?: { name?: string; surname?: string; mail?: string };
  amount: string;
  currency: string;
  // Nullable - a Booking.com cancellation notice in particular can omit stay dates
  // entirely (confirmed on a real live revision, not a hypothetical).
  arrival_date: string | null;
  departure_date: string | null;
  inserted_at: string;
}

export interface ChannexBookingRevision {
  type: "booking_revision";
  id: string;
  attributes: ChannexBookingRevisionAttributes;
}

export interface ChannexBookingRevisionFeedResponse {
  meta: { total: number; page: number; limit: number };
  data: ChannexBookingRevision[];
}

/** GET /bookings/:id returns the same attributes shape as one revision-feed entry. */
export interface ChannexBookingDetailResponse {
  data: ChannexBookingRevision;
}

/**
 * There is no cryptographic webhook signature scheme in Channex's API - confirmed
 * explicitly by their own docs ("Channex webhooks currently do not include a built-in
 * HMAC signature..."). This is just the raw webhook POST body shape.
 */
export interface ChannexWebhookPayload {
  event: string;
  property_id?: string;
  user_id?: string | null;
  timestamp?: string;
  payload?: {
    booking_id?: string;
    property_id?: string;
    revision_id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
