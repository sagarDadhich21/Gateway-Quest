import { getBqProperty, getBqRoomTypeCounts, getBqRoomTypes } from "../../clients/bq/bq.client";
import { forbiddenPropertyAccessError } from "../../errors/AppError";
import { AuthenticatedGqUser } from "../../types/express";
import { PropertyResponseDto, RoomTypeSummaryDto, toPropertyResponseDto, toRoomTypeSummaryDto } from "./property.dto";

/**
 * A user may only ever act on the single property BQ/EQ assigned them
 * (aq_users.property_id). This is enforced here, in GQ, because BQ's own property API
 * has no authentication or ownership checks of its own.
 */
export function assertUserOwnsProperty(user: AuthenticatedGqUser, propertyId: number): void {
  if (user.propertyId === null || user.propertyId !== propertyId) {
    throw forbiddenPropertyAccessError();
  }
}

export async function getPropertyForUser(
  user: AuthenticatedGqUser,
  propertyId: number,
  correlationId: string
): Promise<PropertyResponseDto> {
  assertUserOwnsProperty(user, propertyId);

  const bqProperty = await getBqProperty(propertyId, correlationId);

  return toPropertyResponseDto(bqProperty);
}

/** Read-only room type listing for the GQ UI (name/occupancy/count/onboarding status) - not part of onboarding, reuses the same BQ client calls onboardRoomTypes already makes. */
export async function listRoomTypesForUser(
  user: AuthenticatedGqUser,
  propertyId: number,
  correlationId: string
): Promise<RoomTypeSummaryDto[]> {
  assertUserOwnsProperty(user, propertyId);

  const [allRoomTypes, roomCounts] = await Promise.all([
    getBqRoomTypes(correlationId),
    getBqRoomTypeCounts(propertyId, correlationId),
  ]);

  return allRoomTypes
    .filter((rt) => rt.propertyid === propertyId)
    .map((rt) => toRoomTypeSummaryDto(rt, roomCounts.get(rt.roomtypeid) ?? 0));
}
