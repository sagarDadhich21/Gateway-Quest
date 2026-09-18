import {
  getBqProperty,
  getBqRoomTypeCounts,
  getBqRoomTypes,
  patchBqRoomTypeChannexMapping,
} from "../../clients/bq/bq.client";
import { createChannexRoomType } from "../../clients/channex/channex.client";
import { validationError } from "../../errors/AppError";
import { logger } from "../../services/logger";
import { assertUserOwnsProperty } from "../property/property.service";
import { AuthenticatedGqUser } from "../../types/express";
import { mapBqRoomTypeToChannexPayload } from "./channex.mapper";

export interface RoomTypeOnboardResult {
  roomTypeId: number;
  cxRoomTypeId: string;
  status: "onboarded" | "already_onboarded";
}

/**
 * Onboards every one of a property's BQ room types onto Channex, mirroring
 * onboardProperty in channex.service.ts: GQ Frontend -> GQ Backend -> BQ API ->
 * Channex API, idempotent per room type (skips ones that already carry a
 * cx_room_type_id) rather than one all-or-nothing call.
 *
 * The property itself must already be onboarded (BQ.property.cx_property_id set) -
 * Channex room types are always created under a Channex property, so there is nothing
 * to attach them to otherwise.
 */
export async function onboardRoomTypes(
  user: AuthenticatedGqUser,
  propertyId: number,
  correlationId: string
): Promise<RoomTypeOnboardResult[]> {
  assertUserOwnsProperty(user, propertyId);

  const bqProperty = await getBqProperty(propertyId, correlationId);

  if (!bqProperty.cx_property_id) {
    throw validationError(
      "This property must be onboarded to Channex before its room types can be onboarded."
    );
  }

  const [allRoomTypes, roomCounts] = await Promise.all([
    getBqRoomTypes(correlationId),
    getBqRoomTypeCounts(propertyId, correlationId),
  ]);

  const propertyRoomTypes = allRoomTypes.filter((rt) => rt.propertyid === propertyId);

  const results: RoomTypeOnboardResult[] = [];

  for (const roomType of propertyRoomTypes) {
    if (roomType.cx_room_type_id) {
      results.push({
        roomTypeId: roomType.roomtypeid,
        cxRoomTypeId: roomType.cx_room_type_id,
        status: "already_onboarded",
      });
      continue;
    }

    const roomCount = roomCounts.get(roomType.roomtypeid) ?? 0;
    const payload = mapBqRoomTypeToChannexPayload(roomType, bqProperty.cx_property_id, roomCount);

    const channexResponse = await createChannexRoomType(payload, correlationId);
    const createdRoomType = Array.isArray(channexResponse.data)
      ? channexResponse.data[0]
      : channexResponse.data;
    const cxRoomTypeId = createdRoomType.id;

    await patchBqRoomTypeChannexMapping(roomType.roomtypeid, cxRoomTypeId, correlationId);

    logger.info("channex_room_type_onboarded", {
      correlationId,
      propertyId,
      roomTypeId: roomType.roomtypeid,
      cxRoomTypeId,
    });

    results.push({
      roomTypeId: roomType.roomtypeid,
      cxRoomTypeId,
      status: "onboarded",
    });
  }

  return results;
}
