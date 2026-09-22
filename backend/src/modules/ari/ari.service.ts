import {
  getBqAvailabilityForDateRange,
  getBqProperty,
  getBqRoomTypeCounts,
  getBqRoomTypes,
} from "../../clients/bq/bq.client";
import {
  getChannexAvailability,
  getChannexRestrictions,
  pushChannexAvailability,
  pushChannexRestrictions,
} from "../../clients/channex/channex.client";
import { ChannexAvailabilityValue, ChannexRestrictionValue } from "../../clients/channex/channex.types";
import { getDynamicPricesCalendar } from "../../clients/pricingService/pricingService.client";
import {
  oversellGuardError,
  ratePlanNotFoundError,
  unmappedRatePlanError,
  unmappedRoomTypesError,
  validationError,
} from "../../errors/AppError";
import { toMinorUnits } from "../../lib/currency";
import * as availabilitySnapshotRepo from "../../repositories/gqAvailabilitySnapshot.repository";
import * as pushTaskRepo from "../../repositories/gqPushTask.repository";
import * as ratePlanRepo from "../../repositories/gqRatePlan.repository";
import * as rateRestrictionRepo from "../../repositories/gqRateRestriction.repository";
import { logger } from "../../services/logger";
import { AuthenticatedGqUser } from "../../types/express";
import { assertUserOwnsProperty } from "../property/property.service";
import {
  AvailabilitySnapshotDto,
  DailyAvailabilityDto,
  RestrictionDto,
  toAvailabilitySnapshotDto,
  toDailyAvailabilityDto,
  toRestrictionDto,
} from "./ari.dto";
import { AriDateRangeQuery, PushAvailabilityRequest, PushRestrictionsRequest } from "./ari.schema";

export interface AriSnapshotResult {
  restrictions: RestrictionDto[];
  availability: AvailabilitySnapshotDto[];
}

/**
 * GET /ari - "current" ARI information is what GQ itself last knew/pushed (its own
 * gq_rate_restriction / gq_availability_snapshot rows), not a fresh upstream read -
 * that live read is GET /ari/availability below, per the phase's own split between the
 * two endpoints.
 */
export async function getAri(
  user: AuthenticatedGqUser,
  propertyId: number,
  query: AriDateRangeQuery,
  _correlationId: string
): Promise<AriSnapshotResult> {
  assertUserOwnsProperty(user, propertyId);

  const [restrictionRows, availabilityRows] = await Promise.all([
    rateRestrictionRepo.listRateRestrictions({
      bqPropertyId: propertyId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    }),
    availabilitySnapshotRepo.listAvailabilitySnapshots({
      bqPropertyId: propertyId,
      bqRoomTypeId: query.roomTypeId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    }),
  ]);

  return {
    restrictions: restrictionRows.map(toRestrictionDto),
    availability: availabilityRows.map(toAvailabilitySnapshotDto),
  };
}

/**
 * GET /ari/availability - the real, live availability BQ currently holds (source of
 * truth), read via the existing BQ endpoint - see getBqAvailabilityForDateRange's own
 * doc comment for why this loops one date at a time rather than a single range call.
 */
export async function getAvailability(
  user: AuthenticatedGqUser,
  propertyId: number,
  query: AriDateRangeQuery,
  correlationId: string
): Promise<DailyAvailabilityDto[]> {
  assertUserOwnsProperty(user, propertyId);

  const rows = await getBqAvailabilityForDateRange(propertyId, query.dateFrom, query.dateTo, correlationId);
  const filtered = query.roomTypeId
    ? rows.filter((r) => r.roomTypeId === query.roomTypeId)
    : rows;

  return filtered.map(toDailyAvailabilityDto);
}

export interface PushAvailabilityResult {
  cxTaskId: string;
  /** Whether a read-back from Channex right after the push matched every pushed value. Channex processes ARI pushes asynchronously and documents no task-status endpoint, so this is a best-effort confirmation, not a guarantee - "false" can also just mean Channex hadn't finished processing yet. */
  verified: boolean;
  snapshots: AvailabilitySnapshotDto[];
}

/**
 * POST /ari/availability - pushes explicit availability values to Channex. Every
 * room type referenced must already be mapped (BQ.roomtype.cx_room_type_id), and every
 * value is oversell-guarded against BQ's actual physical room count for that room type
 * before anything is sent to Channex - per this phase's explicit requirement, not
 * pushed first and corrected after.
 */
export async function pushAvailability(
  user: AuthenticatedGqUser,
  propertyId: number,
  body: PushAvailabilityRequest,
  correlationId: string
): Promise<PushAvailabilityResult> {
  assertUserOwnsProperty(user, propertyId);

  const bqProperty = await getBqProperty(propertyId, correlationId);
  if (!bqProperty.cx_property_id) {
    throw validationError("This property must be onboarded to Channex before availability can be pushed.");
  }

  const [allRoomTypes, roomCounts] = await Promise.all([
    getBqRoomTypes(correlationId),
    getBqRoomTypeCounts(propertyId, correlationId),
  ]);

  const roomTypeIds = [...new Set(body.values.map((v) => v.roomTypeId))];
  const roomTypeById = new Map(allRoomTypes.map((rt) => [rt.roomtypeid, rt]));

  const unmapped: string[] = [];
  for (const roomTypeId of roomTypeIds) {
    const roomType = roomTypeById.get(roomTypeId);
    if (!roomType || roomType.propertyid !== propertyId) {
      throw validationError(`roomTypeId ${roomTypeId} does not belong to this property.`);
    }
    if (!roomType.cx_room_type_id) {
      unmapped.push(roomType.roomtypename);
    }
  }
  if (unmapped.length > 0) {
    throw unmappedRoomTypesError(unmapped);
  }

  for (const value of body.values) {
    const totalRooms = roomCounts.get(value.roomTypeId) ?? 0;
    if (value.availability > totalRooms) {
      throw oversellGuardError({
        roomTypeId: value.roomTypeId,
        date: value.date,
        requestedAvailability: value.availability,
        totalRooms,
      });
    }
  }

  const channexValues: ChannexAvailabilityValue[] = body.values.map((v) => ({
    property_id: bqProperty.cx_property_id!,
    room_type_id: roomTypeById.get(v.roomTypeId)!.cx_room_type_id!,
    date: v.date,
    availability: v.availability,
  }));

  const response = await pushChannexAvailability({ values: channexValues }, correlationId);
  const cxTaskId = response.data[0].id;

  const snapshots = await Promise.all(
    body.values.map((v) =>
      availabilitySnapshotRepo.upsertAvailabilitySnapshot({
        bqPropertyId: propertyId,
        bqRoomTypeId: v.roomTypeId,
        date: v.date,
        availableRooms: v.availability,
      })
    )
  );

  await pushTaskRepo.createPushTask({ taskType: "availability", cxTaskId });

  const verified = await confirmAvailabilityPush(bqProperty.cx_property_id, roomTypeById, body.values, correlationId);
  await pushTaskRepo.updatePushTaskStatus(cxTaskId, verified ? "confirmed" : "unconfirmed");

  logger.info("channex_availability_pushed", {
    correlationId,
    propertyId,
    cxTaskId,
    valueCount: body.values.length,
    verified,
  });

  return { cxTaskId, verified, snapshots: snapshots.map(toAvailabilitySnapshotDto) };
}

/**
 * Reads the just-pushed values straight back from Channex and compares them, since
 * there is no documented endpoint to poll the push's task id by status. Any read
 * failure is swallowed (logged, not thrown) - a failed confirmation read must never
 * fail a push that Channex already accepted.
 */
async function confirmAvailabilityPush(
  cxPropertyId: string,
  roomTypeById: Map<number, { cx_room_type_id: string | null }>,
  values: PushAvailabilityRequest["values"],
  correlationId: string
): Promise<boolean> {
  const dates = values.map((v) => v.date).sort();
  try {
    const readBack = await getChannexAvailability(
      cxPropertyId,
      dates[0],
      dates[dates.length - 1],
      correlationId
    );
    return values.every((v) => {
      const cxRoomTypeId = roomTypeById.get(v.roomTypeId)?.cx_room_type_id;
      return cxRoomTypeId !== null && cxRoomTypeId !== undefined
        ? readBack.data[cxRoomTypeId]?.[v.date] === v.availability
        : false;
    });
  } catch (err) {
    logger.warn("channex_availability_confirm_failed", { correlationId, message: (err as Error).message });
    return false;
  }
}

export interface PushRestrictionsResult {
  cxTaskId: string;
  /** Whether a read-back from Channex right after the push matched every pushed value - see PushAvailabilityResult.verified for the same caveat. */
  verified: boolean;
  restrictions: RestrictionDto[];
}

/**
 * POST /ari/restrictions - pushes rates/min-stay/stop-sell values for one rate plan to
 * Channex. When a value omits `rate`, it is read from pricing-service for that date
 * and property (see getDynamicPricesCalendar) rather than silently skipping the price,
 * since Channex requires a rate on every restriction row that is meant to be sellable.
 */
export async function pushRestrictions(
  user: AuthenticatedGqUser,
  propertyId: number,
  body: PushRestrictionsRequest,
  correlationId: string
): Promise<PushRestrictionsResult> {
  assertUserOwnsProperty(user, propertyId);

  const bqProperty = await getBqProperty(propertyId, correlationId);
  if (!bqProperty.cx_property_id) {
    throw validationError("This property must be onboarded to Channex before restrictions can be pushed.");
  }

  const ratePlan = await ratePlanRepo.findRatePlanById(body.ratePlanId);
  if (!ratePlan) {
    throw ratePlanNotFoundError();
  }
  if (ratePlan.bq_property_id !== propertyId) {
    throw validationError("ratePlanId does not belong to this property.");
  }
  if (!ratePlan.cx_rate_plan_id) {
    throw unmappedRatePlanError();
  }

  const valuesMissingRate = body.values.filter((v) => v.rate === undefined);
  let priceByDate = new Map<string, number>();

  if (valuesMissingRate.length > 0) {
    const allRoomTypes = await getBqRoomTypes(correlationId);
    const bqRoomType = allRoomTypes.find((rt) => rt.roomtypeid === ratePlan.bq_room_type_id);
    if (!bqRoomType) {
      throw validationError("This rate plan's room type could not be found in BQ.");
    }

    const dates = body.values.map((v) => v.date).sort();
    const dateFrom = dates[0];
    const dateTo = dates[dates.length - 1];

    const calendar = await getDynamicPricesCalendar(propertyId, dateFrom, dateTo, correlationId);
    const roomTypeCalendar = calendar.room_types.find((rt) => rt.roomtypename === bqRoomType.roomtypename);

    if (roomTypeCalendar) {
      for (const daily of roomTypeCalendar.prices) {
        priceByDate.set(daily.date, daily.dynamicprice ?? daily.baseprice);
      }
    }
  }

  const restrictionInputs = body.values.map((v) => {
    const rateMajor = v.rate ?? priceByDate.get(v.date);
    if (rateMajor === undefined) {
      throw validationError(
        `No price is available from pricing-service for ${v.date} - provide rate explicitly for this date.`
      );
    }
    if (rateMajor <= 0) {
      throw validationError(`rate for ${v.date} must be greater than 0.`);
    }
    return { ...v, rateMajorUnits: rateMajor, rateMinorUnits: toMinorUnits(rateMajor, ratePlan.currency) };
  });

  // Channex rejects the generic `min_stay` field on properties not configured for it
  // ("property doesn't support `min_stay` restriction, please use `min_stay_through`
  // or `min_stay_arrival`" - confirmed from a real CHANNEX_WARNINGS response). Rather
  // than surface that as a push failure, `min_stay` is treated as shorthand for "the
  // same minimum stay whether arriving on this date or already staying through it" and
  // translated into both granular fields - `min_stay` itself is never sent to Channex.
  const channexValues: ChannexRestrictionValue[] = restrictionInputs.map((v) => ({
    property_id: bqProperty.cx_property_id!,
    rate_plan_id: ratePlan.cx_rate_plan_id!,
    date: v.date,
    rate: v.rateMinorUnits,
    min_stay_arrival: v.minStayArrival ?? v.minStay,
    min_stay_through: v.minStayThrough ?? v.minStay,
    max_stay: v.maxStay,
    closed_to_arrival: v.closedToArrival,
    closed_to_departure: v.closedToDeparture,
    stop_sell: v.stopSell,
  }));

  const response = await pushChannexRestrictions({ values: channexValues }, correlationId);
  const cxTaskId = response.data[0].id;

  const restrictions = await Promise.all(
    restrictionInputs.map((v) =>
      rateRestrictionRepo.upsertRateRestriction({
        bqPropertyId: propertyId,
        ratePlanId: body.ratePlanId,
        date: v.date,
        rate: v.rateMinorUnits,
        minStayArrival: v.minStayArrival,
        minStayThrough: v.minStayThrough,
        minStay: v.minStay,
        maxStay: v.maxStay,
        closedToArrival: v.closedToArrival,
        closedToDeparture: v.closedToDeparture,
        stopSell: v.stopSell,
      })
    )
  );

  await pushTaskRepo.createPushTask({ taskType: "restrictions", cxTaskId });

  const verified = await confirmRestrictionsPush(
    bqProperty.cx_property_id,
    ratePlan.cx_rate_plan_id,
    restrictionInputs,
    correlationId
  );
  await pushTaskRepo.updatePushTaskStatus(cxTaskId, verified ? "confirmed" : "unconfirmed");

  logger.info("channex_restrictions_pushed", {
    correlationId,
    propertyId,
    ratePlanId: body.ratePlanId,
    cxTaskId,
    valueCount: body.values.length,
    verified,
  });

  return { cxTaskId, verified, restrictions: restrictions.map(toRestrictionDto) };
}

interface RestrictionInputWithRate {
  date: string;
  rateMajorUnits: number;
  minStayArrival?: number;
  minStayThrough?: number;
  minStay?: number;
  maxStay?: number;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  stopSell?: boolean;
}

/**
 * Reads the just-pushed values straight back from Channex and compares them, since
 * there is no documented endpoint to poll the push's task id by status. Any read
 * failure is swallowed (logged, not thrown) - a failed confirmation read must never
 * fail a push that Channex already accepted.
 *
 * `rate` is compared in major currency units: Channex's POST /restrictions accepts
 * rate as an integer in minor units, but its GET /restrictions read-back documents
 * rate as a decimal string (e.g. "200.00") - i.e. major units, not the same
 * representation as the push. That asymmetry is confirmed from Channex's own docs, not
 * assumed; a small tolerance absorbs float/rounding noise across the conversion.
 */
async function confirmRestrictionsPush(
  cxPropertyId: string,
  cxRatePlanId: string,
  values: RestrictionInputWithRate[],
  correlationId: string
): Promise<boolean> {
  const dates = values.map((v) => v.date).sort();
  try {
    const readBack = await getChannexRestrictions(cxPropertyId, dates[0], dates[dates.length - 1], correlationId);
    const byDate = readBack.data[cxRatePlanId] ?? {};

    return values.every((v) => {
      const fields = byDate[v.date];
      if (!fields) return false;

      const returnedRate = Number(fields.rate);
      if (!Number.isFinite(returnedRate) || Math.abs(returnedRate - v.rateMajorUnits) > 0.01) {
        return false;
      }

      const intFieldMatches = (expected: number | undefined, actual: unknown) =>
        expected === undefined || Number(actual) === expected;
      const boolFieldMatches = (expected: boolean | undefined, actual: unknown) =>
        expected === undefined || Boolean(actual) === expected;

      // Mirrors the min_stay -> min_stay_arrival/min_stay_through fallback the push
      // itself applies (see pushRestrictions) - min_stay is never sent to Channex, so
      // there is nothing to read back under that name.
      return (
        intFieldMatches(v.minStayArrival ?? v.minStay, fields.min_stay_arrival) &&
        intFieldMatches(v.minStayThrough ?? v.minStay, fields.min_stay_through) &&
        intFieldMatches(v.maxStay, fields.max_stay) &&
        boolFieldMatches(v.closedToArrival, fields.closed_to_arrival) &&
        boolFieldMatches(v.closedToDeparture, fields.closed_to_departure) &&
        boolFieldMatches(v.stopSell, fields.stop_sell)
      );
    });
  } catch (err) {
    logger.warn("channex_restrictions_confirm_failed", { correlationId, message: (err as Error).message });
    return false;
  }
}
