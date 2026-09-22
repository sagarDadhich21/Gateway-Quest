import { BqProperty, BqRoomType } from "../../clients/bq/bq.types";

/**
 * What the GQ UI actually needs to show a property. Deliberately excludes BQ-internal
 * or sensitive fields present on BqProperty (gstnumber, pan_number, fssai_number,
 * cin_number, bank_account_name/no, bank_ifsc, created_by, logo/media URLs) - per the
 * requirement to not expose unnecessary/internal fields.
 *
 * `channex.onboarded`/`propertyId` are derived directly from BQ's own
 * `property.cx_property_id` - BQ is the only place this is stored, so there is no
 * separate GQ-side mapping to fall out of sync with it.
 */
export interface PropertyResponseDto {
  id: number;
  name: string;
  city: string;
  location: string;
  address: string;
  phone: string | null;
  email: string | null;
  currency: string | null;
  country: string | null;
  state: string | null;
  zipCode: string | null;
  timeZone: string | null;
  channex: {
    onboarded: boolean;
    propertyId: string | null;
  };
}

/** What the GQ UI needs to render a room type picker/list - name, occupancy and physical count from BQ, plus Channex onboarding status. */
export interface RoomTypeSummaryDto {
  id: number;
  name: string;
  maxOccupancy: number;
  totalRooms: number;
  channex: {
    onboarded: boolean;
    roomTypeId: string | null;
  };
}

export function toRoomTypeSummaryDto(bqRoomType: BqRoomType, totalRooms: number): RoomTypeSummaryDto {
  return {
    id: bqRoomType.roomtypeid,
    name: bqRoomType.roomtypename,
    maxOccupancy: bqRoomType.max_occupancy,
    totalRooms,
    channex: {
      // `!== null` isn't enough here - BQ has real rows where this was cleared to an
      // empty string rather than SQL NULL, which would otherwise read as "onboarded".
      onboarded: Boolean(bqRoomType.cx_room_type_id),
      roomTypeId: bqRoomType.cx_room_type_id || null,
    },
  };
}

export function toPropertyResponseDto(bqProperty: BqProperty): PropertyResponseDto {
  return {
    id: bqProperty.propertyid,
    name: bqProperty.name,
    city: bqProperty.city,
    location: bqProperty.location,
    address: bqProperty.address,
    phone: bqProperty.phone,
    email: bqProperty.email,
    currency: bqProperty.currency,
    country: bqProperty.country,
    state: bqProperty.state,
    zipCode: bqProperty.zip_code,
    timeZone: bqProperty.time_zone,
    channex: {
      // Same empty-string-vs-null caveat as toRoomTypeSummaryDto above.
      onboarded: Boolean(bqProperty.cx_property_id),
      propertyId: bqProperty.cx_property_id || null,
    },
  };
}
