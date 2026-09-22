/**
 * Types mirroring BQ/EQ's actual response shapes, kept in one place so nothing in
 * this service has to guess at a field name. Sourced directly from:
 *  - eq/backend/app/api/userManagement/routes/loginRoutes.py (login response)
 *  - bq/backend/app/api/checkIn/routes/masterdata.py (Property pydantic model + routes)
 *
 * The Channex-related fields on BqProperty match the field set adopted from the
 * "QUEST - Copy" working tree's in-progress schema (see gq/prisma/schema.prisma header
 * comment) - not an independently designed set.
 */

/** aq_users-derived user info embedded in a successful, non-MFA EQ login response. */
export interface BqLoginUserInfo {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  property_id: number | null;
  roles: string[];
  permissions: string[];
}

/**
 * The full set of shapes POST /aq/api/login can return. EQ's login endpoint has four
 * distinct success paths (see loginRoutes.py) plus error responses - GQ only treats the
 * plain `user`-bearing path as a usable login; the others are surfaced as typed errors
 * rather than guessed at.
 */
export type BqLoginResponse =
  | { success: true; user: BqLoginUserInfo; redirect_url: string }
  | { success: true; requires_otp_verification: true; user_id: number; redirect_url: string }
  | { success: true; requires_property_registration: true; redirect_url: string }
  | { success: true; redirect_url: string }; // first_login -> verify-email path (no `user`)

/** BQ's `Property` response model (masterdata.py), plus the Channex fields added for this integration. */
export interface BqProperty {
  propertyid: number;
  propertyname: string;
  city: string;
  name: string;
  location: string;
  address: string;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  homepage_url: string | null;
  homepage_video_url: string | null;
  created_by: number | null;
  checkin_time: string | null;
  checkout_time: string | null;
  created_date: string | null;
  updated_date: string | null;
  gstnumber: string | null;
  pan_number: string | null;
  fssai_number: string | null;
  cin_number: string | null;
  state_code: string | null;
  bank_account_name: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  // Added to BQ's schema/API as part of this integration:
  currency: string | null;
  country: string | null;
  state: string | null;
  zip_code: string | null;
  time_zone: string | null;
  property_type: string | null;
  group_id: string | null;
  min_stay_type: string | null;
  cut_off_time: string | null;
  cut_off_days: number | null;
  allow_availability_autoupdate_on_confirmation: boolean | null;
  allow_availability_autoupdate_on_modification: boolean | null;
  allow_availability_autoupdate_on_cancellation: boolean | null;
  cx_property_id: string | null;
  /** Present in the adopted schema; exact intended meaning not confirmed - not relied on by any logic here. */
  concorded: boolean | null;
}

export interface BqChannexMappingPatchResponse {
  propertyid: number;
  cx_property_id: string | null;
}

/**
 * BQ's `RoomTypeResponse` model (room_master.py), plus the `cx_room_type_id` field
 * added for this integration. Only the fields GQ's onboarding flow actually reads are
 * typed strictly - `baseprice`/`deposit_amount` are serialized as strings by this
 * endpoint's response_model (confirmed against the live server), not used by GQ today.
 */
export interface BqRoomType {
  roomtypeid: number;
  propertyid: number;
  roomtypename: string;
  description: string | null;
  baseprice: string;
  max_occupancy: number;
  deposit_amount: string;
  is_refundable: boolean;
  image_urls: string[];
  amenities: Record<string, unknown>[];
  service_categories: Record<string, unknown>[];
  cx_room_type_id: string | null;
}

/** One entry of GET /bq/api/availability/check-dates/all's `room_types` array (room.py). */
export interface BqRoomTypeAvailability {
  room_type: string;
  roomtypeid: number;
  baseprice: number;
  status: string;
  total_rooms: number;
  booked_rooms: number;
  available_rooms: number;
}

export interface BqRoomTypeAvailabilityResponse {
  checkin: string;
  checkout: string;
  room_types: BqRoomTypeAvailability[];
}

export interface BqRoomTypeChannexMappingPatchResponse {
  roomtypeid: number;
  cx_room_type_id: string | null;
}

/** One (room type, date) availability reading, assembled by looping GET /bq/api/availability/check-dates/all one night at a time - see getBqAvailabilityForDateRange. */
export interface BqDailyAvailability {
  roomTypeId: number;
  date: string; // YYYY-MM-DD
  totalRooms: number;
  bookedRooms: number;
  availableRooms: number;
}
