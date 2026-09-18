import { z } from "zod";
import { BqProperty, BqRoomType } from "../../clients/bq/bq.types";
import { validationError } from "../../errors/AppError";
import {
  ChannexPropertyCreateRequest,
  ChannexRatePlanCreateRequest,
  ChannexRoomTypeCreateRequest,
} from "../../clients/channex/channex.types";

/**
 * The subset of BQ property fields required to build a valid Channex property payload,
 * per Channex's documented required fields (title, currency, country, city, address,
 * timezone - see docs.channex.io, mirrored in CHANNEX_BQ_API_DB_MAPPING.md section 1.2).
 * `state` and `zip_code`/`phone`/`email` are accepted by Channex but not required, so
 * they stay optional here too.
 */
const requiredForChannexSchema = z.object({
  name: z.string().min(1, "property.name"),
  currency: z.string().length(3, "property.currency (must be a 3-letter ISO 4217 code)"),
  country: z.string().length(2, "property.country (must be a 2-letter ISO country code)"),
  city: z.string().min(1, "property.city"),
  address: z.string().min(1, "property.address"),
  time_zone: z.string().min(1, "property.time_zone"),
});

/**
 * Validates the BQ property carries everything Channex requires, then builds the exact
 * request body documented by Channex (see channex.types.ts). Throws a single
 * PROPERTY_MISSING_CHANNEX_FIELDS validation error listing every missing field at once,
 * rather than failing on the first one, so the caller can fix the property record in
 * one pass.
 */
export function mapBqPropertyToChannexPayload(
  bqProperty: BqProperty
): ChannexPropertyCreateRequest {
  const result = requiredForChannexSchema.safeParse(bqProperty);

  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.message);
    throw validationError(
      "This property is missing fields required by Channex. Update the property in BQ before onboarding.",
      { missingFields: missing }
    );
  }

  const validated = result.data;

  return {
    property: {
      title: validated.name,
      currency: validated.currency,
      country: validated.country,
      city: validated.city,
      address: validated.address,
      timezone: validated.time_zone,
      email: bqProperty.email ?? undefined,
      phone: bqProperty.phone ?? undefined,
      zip_code: bqProperty.zip_code ?? undefined,
      state: bqProperty.state ?? undefined,
      property_type: bqProperty.property_type ?? "hotel",
    },
  };
}

/**
 * The subset of BQ room type fields required to build a valid Channex room-type
 * payload, per Channex's documented required fields (title, count_of_rooms, occ_adults
 * - see CHANNEX_BQ_API_DB_MAPPING.md section 2.2/2.3).
 */
const requiredForChannexRoomTypeSchema = z.object({
  roomtypename: z.string().min(1, "roomtype.roomtypename"),
  max_occupancy: z.number().int().positive("roomtype.max_occupancy must be a positive integer"),
});

/**
 * Validates the BQ room type carries everything Channex requires, then builds the
 * exact request body Channex documents (see channex.types.ts). Mirrors
 * mapBqPropertyToChannexPayload's validate-then-build shape above.
 *
 * BQ has no adults/children/infants occupancy split (only one `max_occupancy` int) -
 * per CHANNEX_BQ_API_DB_MAPPING.md section 2.3's flagged [NEEDS DECISION], this uses
 * the documented lossy-but-workable default: occ_adults = max_occupancy,
 * occ_children = 0, occ_infants = 0, default_occupancy = max_occupancy.
 */
export function mapBqRoomTypeToChannexPayload(
  bqRoomType: BqRoomType,
  cxPropertyId: string,
  roomCount: number
): ChannexRoomTypeCreateRequest {
  const result = requiredForChannexRoomTypeSchema.safeParse(bqRoomType);

  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.message);
    throw validationError(
      "This room type is missing fields required by Channex. Update the room type in BQ before onboarding.",
      { missingFields: missing }
    );
  }

  if (!Number.isInteger(roomCount) || roomCount <= 0) {
    throw validationError(
      "This room type has no physical rooms in BQ. Add at least one room before onboarding it to Channex."
    );
  }

  const validated = result.data;

  return {
    room_type: {
      property_id: cxPropertyId,
      title: validated.roomtypename,
      count_of_rooms: roomCount,
      occ_adults: validated.max_occupancy,
      occ_children: 0,
      occ_infants: 0,
      default_occupancy: validated.max_occupancy,
      room_kind: "room",
      content: bqRoomType.description ? { description: bqRoomType.description } : undefined,
    },
  };
}

/**
 * Builds the Channex rate-plan creation payload from a GQ-owned gq_rate_plan row (see
 * CHANNEX_BQ_API_DB_MAPPING.md section 3.2/3.3). Unlike property/room-type, there is
 * nothing to "validate as missing" here - gq_rate_plan's own required columns (name,
 * currency, sell_mode, rate_mode) are enforced at the zod/DB layer before a row can
 * exist at all, so this is a pure builder, not a validate-then-build function.
 *
 * `tax_set_id` is deliberately omitted per this phase's explicit scope. Every option's
 * `rate` is forced to 0 regardless of input - real rates are pushed later via ARI, not
 * implemented here.
 */
export function mapGqRatePlanToChannexPayload(
  ratePlan: {
    name: string;
    currency: string;
    sell_mode: string;
    rate_mode: string;
  },
  cxPropertyId: string,
  cxRoomTypeId: string,
  cxParentRatePlanId: string | null,
  options: Array<{ occupancy: number; is_primary: boolean }>
): ChannexRatePlanCreateRequest {
  return {
    rate_plan: {
      title: ratePlan.name,
      property_id: cxPropertyId,
      room_type_id: cxRoomTypeId,
      parent_rate_plan_id: cxParentRatePlanId,
      currency: ratePlan.currency,
      sell_mode: ratePlan.sell_mode as "per_room" | "per_person",
      rate_mode: ratePlan.rate_mode as "manual" | "derived" | "auto" | "cascade",
      options: options.map((o) => ({ occupancy: o.occupancy, is_primary: o.is_primary, rate: 0 })),
    },
  };
}
