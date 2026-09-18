import { getBqProperty } from "../../clients/bq/bq.client";
import { forbiddenPropertyAccessError } from "../../errors/AppError";
import { AuthenticatedGqUser } from "../../types/express";
import { PropertyResponseDto, toPropertyResponseDto } from "./property.dto";

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
