import axios, { AxiosError, AxiosInstance } from "axios";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { logger } from "../../services/logger";
import {
  BqChannexMappingPatchResponse,
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
