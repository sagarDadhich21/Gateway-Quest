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
