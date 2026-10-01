import axios, { AxiosError, AxiosInstance } from "axios";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { logger } from "../../services/logger";
import {
  BqBookingListItem,
  BqCancelBookingResponse,
  BqChannexMappingPatchResponse,
  BqCreateBookingRequest,
  BqCreateBookingResponse,
  BqDailyAvailability,
  BqLoginResponse,
  BqProperty,
  BqRoomType,
  BqRoomTypeAvailabilityResponse,
  BqRoomTypeChannexMappingPatchResponse,
} from "./bq.types";

/**
 * All server-to-server calls to BQ (property data) and EQ/AQ (login) go through this
 * module. GQ never talks to either service's database directly.
 */

const aqHttp: AxiosInstance = axios.create({
  baseURL: env.AQ_BASE_URL,
  timeout: env.UPSTREAM_TIMEOUT_MS,
});

const bqHttp: AxiosInstance = axios.create({
  baseURL: env.BQ_BASE_URL,
  timeout: env.UPSTREAM_TIMEOUT_MS,
});

function toUpstreamError(
  err: unknown,
  upstreamName: "BQ",
  correlationId: string
): AppError {
  const axiosErr = err as AxiosError<{ detail?: string }>;

  if (axiosErr.isAxiosError && !axiosErr.response) {
    logger.error("upstream_unreachable", {
      correlationId,
      upstream: upstreamName,
      message: axiosErr.message,
    });
    return new AppError(
      "BQ_UPSTREAM_UNAVAILABLE",
      502,
      `${upstreamName} is currently unavailable. Please try again shortly.`
    );
  }

  const status = axiosErr.response?.status ?? 500;
  const upstreamDetail = axiosErr.response?.data?.detail;
  logger.error("upstream_error", {
    correlationId,
    upstream: upstreamName,
    status,
    detail: upstreamDetail,
  });
  return new AppError(
    "BQ_UPSTREAM_ERROR",
    status >= 400 && status < 500 ? status : 502,
    `${upstreamName} rejected the request${upstreamDetail ? `: ${upstreamDetail}` : "."}`
  );
}

/**
 * Authenticates against EQ/AQ's existing login endpoint (POST /aq/api/login). This is
 * the "existing BQ/HMS authentication mechanism" - GQ never stores or checks a password
 * itself. Cookies EQ sets on this response are ignored entirely; GQ only reads the JSON
 * body and, on success, mints its own separate session (see auth.service.ts).
 */
export async function loginAgainstBq(
  email: string,
  password: string,
  correlationId: string
): Promise<BqLoginResponse> {
  try {
    const response = await aqHttp.post<BqLoginResponse>("/aq/api/login", {
      email,
      password,
    });
    return response.data;
  } catch (err) {
    const axiosErr = err as AxiosError<{ detail?: string }>;
    if (axiosErr.response && axiosErr.response.status === 400) {
      // EQ returns 400 for both "user not found" and "invalid credentials" - GQ
      // deliberately does not distinguish these to the caller either.
      throw new AppError(
        "INVALID_CREDENTIALS",
        401,
        "Invalid email or password."
      );
    }
    throw toUpstreamError(err, "BQ", correlationId);
  }
}

export async function getBqProperty(
  propertyId: number,
  correlationId: string
): Promise<BqProperty> {
  try {
    const response = await bqHttp.get<BqProperty>(`/bq/api/properties/${propertyId}`);
    return response.data;
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.status === 404) {
      throw new AppError("PROPERTY_NOT_FOUND", 404, "Property not found.");
    }
    throw toUpstreamError(err, "BQ", correlationId);
  }
}

/**
 * BQ's `GET /roomtypes/` (room_master.py) has no property filter of its own - it
 * always returns every room type across every property. Callers filter by propertyid
 * themselves (same approach BQ's own admin UI takes; there is no server-side filter to
 * reuse instead).
 */
export async function getBqRoomTypes(correlationId: string): Promise<BqRoomType[]> {
  try {
    const response = await bqHttp.get<BqRoomType[]>("/bq/api/roomtypes/");
    return response.data;
  } catch (err) {
    throw toUpstreamError(err, "BQ", correlationId);
  }
}

/**
 * BQ has no dedicated "physical room count per room type" endpoint - the closest real
 * one is the date-range availability check (room.py), which happens to return
 * `total_rooms` per room type as a side effect of computing availability for that
 * range. GQ only needs `total_rooms`, so it queries a single, arbitrary one-night
 * window (today -> tomorrow) purely to get that count; `booked_rooms`/`available_rooms`
 * are ignored.
 */
export async function getBqRoomTypeCounts(
  propertyId: number,
  correlationId: string
): Promise<Map<number, number>> {
  const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  try {
    const response = await bqHttp.get<BqRoomTypeAvailabilityResponse>(
      "/bq/api/availability/check-dates/all",
      {
        params: {
          checkin: toIsoDate(today),
          checkout: toIsoDate(tomorrow),
          property_id: propertyId,
        },
      }
    );
    const counts = new Map<number, number>();
    for (const rt of response.data.room_types) {
      counts.set(rt.roomtypeid, rt.total_rooms);
    }
    return counts;
  } catch (err) {
    const axiosErr = err as AxiosError;
    // BQ 404s this endpoint when the property has no room types at all yet - that is
    // "zero rooms for every type", not an upstream failure.
    if (axiosErr.response?.status === 404) {
      return new Map();
    }
    throw toUpstreamError(err, "BQ", correlationId);
  }
}

function* eachDate(dateFrom: string, dateTo: string): Generator<string> {
  const cursor = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  while (cursor <= end) {
    yield cursor.toISOString().slice(0, 10);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

/** How many single-night BQ calls getBqAvailabilityForDateRange fires concurrently per batch - bounded so a long date range doesn't slam BQ with hundreds of simultaneous requests. */
const AVAILABILITY_FETCH_CONCURRENCY = 8;

async function fetchAvailabilityForOneDate(
  propertyId: number,
  date: string,
  correlationId: string
): Promise<BqDailyAvailability[]> {
  const checkout = new Date(`${date}T00:00:00Z`);
  checkout.setUTCDate(checkout.getUTCDate() + 1);

  try {
    const response = await bqHttp.get<BqRoomTypeAvailabilityResponse>(
      "/bq/api/availability/check-dates/all",
      { params: { checkin: date, checkout: checkout.toISOString().slice(0, 10), property_id: propertyId } }
    );
    return response.data.room_types.map((rt) => ({
      roomTypeId: rt.roomtypeid,
      date,
      totalRooms: rt.total_rooms,
      bookedRooms: rt.booked_rooms,
      availableRooms: rt.available_rooms,
    }));
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.status === 404) {
      return []; // no room types / no data for this date - not an upstream failure
    }
    throw toUpstreamError(err, "BQ", correlationId);
  }
}

/**
 * BQ has no per-day, date-range availability endpoint - the only date-scoped one
 * (GET /bq/api/availability/check-dates/all) returns one aggregate count for the whole
 * requested range, not itemized per day (same gap documented in
 * CHANNEX_BQ_API_DB_MAPPING.md section 4.1). This reuses that same endpoint the way
 * getBqRoomTypeCounts above already does - a single-night window - but calls it once
 * per date in the range instead of building a new BQ endpoint, per this phase's
 * explicit scope (reuse existing APIs only). Dates are fetched in bounded-concurrency
 * batches (see AVAILABILITY_FETCH_CONCURRENCY) rather than one at a time, so a
 * multi-week/month range doesn't take one round-trip's latency times the day count.
 */
export async function getBqAvailabilityForDateRange(
  propertyId: number,
  dateFrom: string,
  dateTo: string,
  correlationId: string
): Promise<BqDailyAvailability[]> {
  const dates = [...eachDate(dateFrom, dateTo)];
  const results: BqDailyAvailability[] = [];

  for (let i = 0; i < dates.length; i += AVAILABILITY_FETCH_CONCURRENCY) {
    const batch = dates.slice(i, i + AVAILABILITY_FETCH_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((date) => fetchAvailabilityForOneDate(propertyId, date, correlationId))
    );
    for (const dayResults of batchResults) {
      results.push(...dayResults);
    }
  }

  return results;
}

/**
 * Writes the Channex room_type id back onto BQ.roomtype.cx_room_type_id via the new
 * PATCH /bq/api/roomtypes/{id}/channex-mapping endpoint added alongside this service
 * (see room_master.py), mirroring patchBqChannexMapping below for properties.
 */
export async function patchBqRoomTypeChannexMapping(
  roomTypeId: number,
  cxRoomTypeId: string,
  correlationId: string
): Promise<BqRoomTypeChannexMappingPatchResponse> {
  try {
    const response = await bqHttp.patch<BqRoomTypeChannexMappingPatchResponse>(
      `/bq/api/roomtypes/${roomTypeId}/channex-mapping`,
      { cx_room_type_id: cxRoomTypeId }
    );
    return response.data;
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.status === 404) {
      throw new AppError("ROOM_TYPE_NOT_FOUND", 404, "Room type not found.");
    }
    throw toUpstreamError(err, "BQ", correlationId);
  }
}

/**
 * Writes the Channex property id back onto BQ.property.cx_property_id via the new
 * PATCH /bq/api/properties/{id}/channex-mapping endpoint added alongside this service
 * (see masterdata.py). This is the only field GQ ever writes on BQ's property record.
 */
export async function patchBqChannexMapping(
  propertyId: number,
  cxPropertyId: string,
  correlationId: string
): Promise<BqChannexMappingPatchResponse> {
  try {
    const response = await bqHttp.patch<BqChannexMappingPatchResponse>(
      `/bq/api/properties/${propertyId}/channex-mapping`,
      { cx_property_id: cxPropertyId }
    );
    return response.data;
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.status === 404) {
      throw new AppError("PROPERTY_NOT_FOUND", 404, "Property not found.");
    }
    throw toUpstreamError(err, "BQ", correlationId);
  }
}

/**
 * Lists every BQ property (GET /bq/api/properties, no filter params) - used to resolve
 * a Channex webhook/revision's property_id (a Channex uuid) back to a BQ property by
 * matching cx_property_id client-side, the same convention getBqRoomTypes already uses.
 */
export async function listBqProperties(correlationId: string): Promise<BqProperty[]> {
  try {
    const response = await bqHttp.get<BqProperty[]>("/bq/api/properties");
    return response.data;
  } catch (err) {
    throw toUpstreamError(err, "BQ", correlationId);
  }
}

/** POST /bq/api/create-reservation-online-new/ - the only real BQ booking-creation endpoint (used for OTA bookings via the booking_type/booking_status/fixed_amount fields added alongside this integration). */
export async function createBqBooking(
  payload: BqCreateBookingRequest,
  correlationId: string
): Promise<BqCreateBookingResponse> {
  try {
    const response = await bqHttp.post<BqCreateBookingResponse>(
      "/bq/api/create-reservation-online-new/",
      payload
    );
    return response.data;
  } catch (err) {
    const axiosErr = err as AxiosError<{ detail?: unknown }>;
    if (axiosErr.response?.status && axiosErr.response.status < 500) {
      throw new AppError(
        "BQ_UPSTREAM_ERROR",
        axiosErr.response.status,
        `BQ rejected the booking: ${JSON.stringify(axiosErr.response.data?.detail ?? axiosErr.message)}`
      );
    }
    throw toUpstreamError(err, "BQ", correlationId);
  }
}

/**
 * GET /bq/api/bookings/ has no filter params - fetches every booking and finds the one
 * matching bookingId client-side, used to verify a just-created booking actually
 * exists in BQ (per this phase's explicit "verify the booking through BQ API" step).
 */
export async function findBqBookingById(
  bookingId: string,
  correlationId: string
): Promise<BqBookingListItem | null> {
  try {
    const response = await bqHttp.get<{ bookings: BqBookingListItem[] }>("/bq/api/bookings/");
    return response.data.bookings.find((b) => b.bookingid === bookingId) ?? null;
  } catch (err) {
    throw toUpstreamError(err, "BQ", correlationId);
  }
}

/** POST /bq/api/cancel-booking/?orderid=... - cancels every (non-checked-in) booking row under that order id. */
export async function cancelBqBooking(
  orderId: string,
  cancellationReason: string,
  correlationId: string
): Promise<BqCancelBookingResponse> {
  try {
    const response = await bqHttp.post<BqCancelBookingResponse>(
      "/bq/api/cancel-booking/",
      { cancellation_reason: cancellationReason },
      { params: { orderid: orderId } }
    );
    return response.data;
  } catch (err) {
    const axiosErr = err as AxiosError<{ detail?: unknown }>;
    if (axiosErr.response?.status === 404) {
      throw new AppError("BOOKING_NOT_FOUND", 404, "Booking not found in BQ for this order id.");
    }
    if (axiosErr.response?.status && axiosErr.response.status < 500) {
      throw new AppError(
        "BQ_UPSTREAM_ERROR",
        axiosErr.response.status,
        `BQ rejected the cancellation: ${JSON.stringify(axiosErr.response.data?.detail ?? axiosErr.message)}`
      );
    }
    throw toUpstreamError(err, "BQ", correlationId);
  }
}

/**
 * POST /bq/api/modify-booking/ - updates dates and/or room type only (BQ's own query
 * params, confirmed from bookingchange.py). BQ recalculates pricing internally on
 * modification same as creation - there is no equivalent fixed_amount override for
 * this endpoint, so a modified OTA booking's amount in BQ may not match Channex's
 * revised amount. Flagged as a known limitation, not silently papered over.
 */
export async function modifyBqBooking(
  bookingId: string,
  changes: { newRoomTypeName?: string; newCheckinDate?: string; newCheckoutDate?: string },
  correlationId: string
): Promise<unknown> {
  try {
    const response = await bqHttp.post(
      "/bq/api/modify-booking/",
      {},
      {
        params: {
          booking_id: bookingId,
          new_room_type_name: changes.newRoomTypeName,
          new_checkin_date: changes.newCheckinDate,
          new_checkout_date: changes.newCheckoutDate,
        },
      }
    );
    return response.data;
  } catch (err) {
    const axiosErr = err as AxiosError<{ detail?: unknown }>;
    if (axiosErr.response?.status === 404) {
      throw new AppError("BOOKING_NOT_FOUND", 404, "Booking not found in BQ.");
    }
    if (axiosErr.response?.status && axiosErr.response.status < 500) {
      throw new AppError(
        "BQ_UPSTREAM_ERROR",
        axiosErr.response.status,
        `BQ rejected the modification: ${JSON.stringify(axiosErr.response.data?.detail ?? axiosErr.message)}`
      );
    }
    throw toUpstreamError(err, "BQ", correlationId);
  }
}
