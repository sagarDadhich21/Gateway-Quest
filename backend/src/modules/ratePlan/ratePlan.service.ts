import { getBqProperty, getBqRoomTypes } from "../../clients/bq/bq.client";
import { BqRoomType } from "../../clients/bq/bq.types";
import { createChannexRatePlan } from "../../clients/channex/channex.client";
import { ratePlanNotFoundError, validationError } from "../../errors/AppError";
import { logger } from "../../services/logger";
import * as ratePlanRepo from "../../repositories/gqRatePlan.repository";
import { assertUserOwnsProperty } from "../property/property.service";
import { AuthenticatedGqUser } from "../../types/express";
import { mapGqRatePlanToChannexPayload } from "../channex/channex.mapper";
import { RatePlanResponseDto, toRatePlanResponseDto } from "./ratePlan.dto";
import { CreateRatePlanRequest, UpdateRatePlanRequest } from "./ratePlan.schema";

/** Fetches BQ's room type for a property and confirms it's already onboarded to Channex - a rate plan cannot exist without one. */
async function requireOnboardedBqRoomType(
  propertyId: number,
  roomTypeId: number,
  correlationId: string
): Promise<BqRoomType & { cx_room_type_id: string }> {
  const allRoomTypes = await getBqRoomTypes(correlationId);
  const bqRoomType = allRoomTypes.find((rt) => rt.roomtypeid === roomTypeId);

  if (!bqRoomType || bqRoomType.propertyid !== propertyId) {
    throw validationError("roomTypeId does not belong to this property.");
  }
  if (!bqRoomType.cx_room_type_id) {
    throw validationError(
      "This room type must be onboarded to Channex before a rate plan can be created for it."
    );
  }

  return { ...bqRoomType, cx_room_type_id: bqRoomType.cx_room_type_id };
}

function assertOccupancyWithinRoomType(occupancy: number, maxOccupancy: number): void {
  if (occupancy > maxOccupancy) {
    throw validationError(
      `Option occupancy (${occupancy}) cannot exceed the room type's max occupancy (${maxOccupancy}).`
    );
  }
}

export interface CreateRatePlanResult {
  ratePlan: RatePlanResponseDto;
  created: boolean;
}

/**
 * Creates a GQ-owned rate plan and onboards it onto Channex in one step (GQ is the
 * only source of truth for rate plans - BQ has no rate-plan entity at all, per this
 * phase's explicit scope).
 *
 * Idempotency: since GQ (not BQ) is what's being created here, "already exists" is
 * decided by (room type, name) rather than a BQ id GQ can check first - a second call
 * with the same room type + name returns the existing rate plan instead of creating a
 * duplicate GQ row and a duplicate Channex rate plan.
 */
export async function createRatePlan(
  user: AuthenticatedGqUser,
  input: CreateRatePlanRequest,
  correlationId: string
): Promise<CreateRatePlanResult> {
  assertUserOwnsProperty(user, input.propertyId);

  const existing = await ratePlanRepo.findRatePlanByRoomTypeAndName(input.roomTypeId, input.name);
  if (existing) {
    return { ratePlan: toRatePlanResponseDto(existing), created: false };
  }

  const bqProperty = await getBqProperty(input.propertyId, correlationId);
  if (!bqProperty.cx_property_id) {
    throw validationError("This property must be onboarded to Channex before a rate plan can be created.");
  }

  const bqRoomType = await requireOnboardedBqRoomType(input.propertyId, input.roomTypeId, correlationId);

  for (const option of input.options) {
    assertOccupancyWithinRoomType(option.occupancy, bqRoomType.max_occupancy);
  }

  const currency = input.currency ?? bqProperty.currency;
  if (!currency) {
    throw validationError("currency is required (this property has no default currency in BQ either).");
  }

  let cxParentRatePlanId: string | null = null;
  if (input.parentRatePlanId) {
    const parent = await ratePlanRepo.findRatePlanById(input.parentRatePlanId);
    if (!parent || parent.bq_room_type_id !== input.roomTypeId) {
      throw validationError("parentRatePlanId must reference an existing rate plan for the same room type.");
    }
    if (!parent.cx_rate_plan_id) {
      throw validationError("The parent rate plan must be onboarded to Channex before being used as a parent.");
    }
    cxParentRatePlanId = parent.cx_rate_plan_id;
  }

  const createdRow = await ratePlanRepo.createRatePlan({
    bqPropertyId: input.propertyId,
    bqRoomTypeId: input.roomTypeId,
    name: input.name,
    currency,
    sellMode: input.sellMode,
    rateMode: input.rateMode,
    mealType: input.mealType,
    parentRatePlanId: input.parentRatePlanId ?? null,
    isDefault: input.isDefault,
    options: input.options,
  });

  const payload = mapGqRatePlanToChannexPayload(
    createdRow,
    bqProperty.cx_property_id,
    bqRoomType.cx_room_type_id,
    cxParentRatePlanId,
    createdRow.gq_rate_plan_option
  );

  const channexResponse = await createChannexRatePlan(payload, correlationId);
  const createdOnChannex = Array.isArray(channexResponse.data)
    ? channexResponse.data[0]
    : channexResponse.data;

  const updatedRow = await ratePlanRepo.setRatePlanCxId(createdRow.id, createdOnChannex.id);

  logger.info("channex_rate_plan_onboarded", {
    correlationId,
    propertyId: input.propertyId,
    roomTypeId: input.roomTypeId,
    ratePlanId: createdRow.id,
    cxRatePlanId: createdOnChannex.id,
  });

  return { ratePlan: toRatePlanResponseDto(updatedRow), created: true };
}

export async function getRatePlan(
  user: AuthenticatedGqUser,
  ratePlanId: string
): Promise<RatePlanResponseDto> {
  const row = await ratePlanRepo.findRatePlanById(ratePlanId);
  if (!row) {
    throw ratePlanNotFoundError();
  }
  assertUserOwnsProperty(user, row.bq_property_id);
  return toRatePlanResponseDto(row);
}

export interface ListRatePlansQuery {
  propertyId?: number;
  roomTypeId?: number;
}

/** Defaults to the caller's own assigned property when propertyId isn't given - GQ users are scoped to one property. */
export async function listRatePlansForUser(
  user: AuthenticatedGqUser,
  query: ListRatePlansQuery
): Promise<RatePlanResponseDto[]> {
  const propertyId = query.propertyId ?? user.propertyId ?? undefined;
  if (propertyId === undefined) {
    throw validationError("propertyId is required.");
  }
  assertUserOwnsProperty(user, propertyId);

  const rows = await ratePlanRepo.listRatePlans({
    bqPropertyId: propertyId,
    bqRoomTypeId: query.roomTypeId,
  });
  return rows.map(toRatePlanResponseDto);
}

/**
 * Updates local GQ fields only. There is no confirmed Channex rate-plan update
 * endpoint in CHANNEX_BQ_API_DB_MAPPING.md (only creation, section 3.2) - changes here
 * are not pushed to Channex. Flagged as a remaining decision in the phase report.
 */
export async function updateRatePlan(
  user: AuthenticatedGqUser,
  ratePlanId: string,
  patch: UpdateRatePlanRequest,
  correlationId: string
): Promise<RatePlanResponseDto> {
  const row = await ratePlanRepo.findRatePlanById(ratePlanId);
  if (!row) {
    throw ratePlanNotFoundError();
  }
  assertUserOwnsProperty(user, row.bq_property_id);

  if (patch.options) {
    const allRoomTypes = await getBqRoomTypes(correlationId);
    const bqRoomType = allRoomTypes.find((rt) => rt.roomtypeid === row.bq_room_type_id);
    if (bqRoomType) {
      for (const option of patch.options) {
        assertOccupancyWithinRoomType(option.occupancy, bqRoomType.max_occupancy);
      }
    }
    await ratePlanRepo.replaceRatePlanOptions(ratePlanId, patch.options);
  }

  const hasScalarChanges =
    patch.name !== undefined ||
    patch.currency !== undefined ||
    patch.sellMode !== undefined ||
    patch.rateMode !== undefined ||
    patch.mealType !== undefined ||
    patch.isDefault !== undefined;

  const updatedRow = hasScalarChanges
    ? await ratePlanRepo.updateRatePlanFields(ratePlanId, patch)
    : await ratePlanRepo.findRatePlanById(ratePlanId);

  return toRatePlanResponseDto(updatedRow!);
}

/**
 * Deletes the local GQ rate plan only. There is no confirmed Channex rate-plan delete
 * endpoint in CHANNEX_BQ_API_DB_MAPPING.md - the Channex-side rate plan is left in
 * place. Flagged as a remaining decision in the phase report.
 */
export async function deleteRatePlan(user: AuthenticatedGqUser, ratePlanId: string): Promise<void> {
  const row = await ratePlanRepo.findRatePlanById(ratePlanId);
  if (!row) {
    throw ratePlanNotFoundError();
  }
  assertUserOwnsProperty(user, row.bq_property_id);

  const childCount = await ratePlanRepo.countChildRatePlans(ratePlanId);
  if (childCount > 0) {
    throw validationError("Cannot delete a rate plan that other rate plans inherit from as their parent.");
  }

  await ratePlanRepo.deleteRatePlan(ratePlanId);
}
