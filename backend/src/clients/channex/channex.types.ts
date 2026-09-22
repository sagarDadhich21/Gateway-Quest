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
