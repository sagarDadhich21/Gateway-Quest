import axios, { AxiosError, AxiosInstance } from "axios";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { logApiCall } from "../../repositories/gqApiLog.repository";
import { logger } from "../../services/logger";
import {
  ChannexAriPushResponse,
  ChannexAvailabilityPushRequest,
  ChannexAvailabilityReadResponse,
  ChannexPropertyCreateRequest,
  ChannexPropertyCreateResponse,
  ChannexRatePlanCreateRequest,
  ChannexRatePlanCreateResponse,
  ChannexRestrictionsPushRequest,
  ChannexRestrictionsReadResponse,
  ChannexRoomTypeCreateRequest,
  ChannexRoomTypeCreateResponse,
} from "./channex.types";

const CREATE_PROPERTY_ENDPOINT = "/properties";
const CREATE_ROOM_TYPE_ENDPOINT = "/room_types";
const CREATE_RATE_PLAN_ENDPOINT = "/rate_plans";
const PUSH_AVAILABILITY_ENDPOINT = "/availability";
const PUSH_RESTRICTIONS_ENDPOINT = "/restrictions";
const READ_AVAILABILITY_ENDPOINT = "/availability";
const READ_RESTRICTIONS_ENDPOINT = "/restrictions";

const channexHttp: AxiosInstance = axios.create({
  baseURL: env.CHANNEX_BASE_URL,
  timeout: env.UPSTREAM_TIMEOUT_MS,
  headers: {
    // Confirmed header name/format from docs.channex.io - not `Authorization: Bearer`.
    "user-api-key": env.CHANNEX_API_KEY,
    "Content-Type": "application/json",
  },
});
 
/**
 * Maps a Channex API failure to a safe AppError. Never includes the API key or raw
 * upstream body in what gets logged or returned - only status code and Channex's own
 * `errors`/`message` text, which Channex documents as safe, non-sensitive validation
 * feedback (e.g. "currency must be a 3-letter code").
 */
function toChannexError(err: unknown, correlationId: string): AppError {
  const axiosErr = err as AxiosError<{ errors?: unknown; message?: string }>;
 
  if (axiosErr.isAxiosError && !axiosErr.response) {
    logger.error("channex_unreachable", { correlationId, message: axiosErr.message });
    return new AppError(
      "CHANNEX_UPSTREAM_UNAVAILABLE",
      502,
      "Channex is currently unavailable. Please try again shortly."
    );
  }
 
  const status = axiosErr.response?.status ?? 500;
  const upstreamMessage = axiosErr.response?.data?.message;
  const upstreamErrors = axiosErr.response?.data?.errors;
 
  logger.error("channex_rejected", {
    correlationId,
    status,
    message: upstreamMessage,
  });
 
  // 400/401/403/404/422 are all distinct, real Channex outcomes per the integration
  // requirements - surfaced with their real status rather than collapsed to one code,
  // but never with the raw Channex response body (which is not documented as safe).
  return new AppError(
    "CHANNEX_UPSTREAM_ERROR",
    status,
    upstreamMessage ? `Channex rejected the request: ${upstreamMessage}` : "Channex rejected the request.",
    upstreamErrors ? { channexErrors: upstreamErrors } : undefined
  );
}
 
export async function createChannexProperty(
  payload: ChannexPropertyCreateRequest,
  correlationId: string
): Promise<ChannexPropertyCreateResponse> {
  const startedAt = Date.now();
  let httpStatus = 0;
 
  let response;
  try {
    response = await channexHttp.post<ChannexPropertyCreateResponse>(
      CREATE_PROPERTY_ENDPOINT,
      payload
    );
    httpStatus = response.status;
  } catch (err) {
    const axiosErr = err as AxiosError;
    httpStatus = axiosErr.response?.status ?? 0;
    await logApiCall({
      method: "POST",
      endpoint: CREATE_PROPERTY_ENDPOINT,
      httpStatus,
      latencyMs: Date.now() - startedAt,
    });
    throw toChannexError(err, correlationId);
  }
 
  await logApiCall({
    method: "POST",
    endpoint: CREATE_PROPERTY_ENDPOINT,
    httpStatus,
    latencyMs: Date.now() - startedAt,
  });
 
  const body = response.data;
 
  // Channex may return one created resource as an object or as a one-item array.
  // Normalize both forms so the onboarding service has one stable response shape.
  if (body && !Array.isArray(body.data) && body.data) {
    body.data = [body.data];
  }
 
  // A 200/201 from Channex can still carry row-level failures in meta.warnings - per
  // the integration requirements this must NOT be treated as success.
  if (body.meta?.warnings && body.meta.warnings.length > 0) {
    logger.warn("channex_warnings_on_create", {
      correlationId,
      warningCount: body.meta.warnings.length,
    });
    throw new AppError(
      "CHANNEX_WARNINGS",
      422,
      "Channex accepted the request but reported warnings that indicate the property was not created correctly.",
      { warnings: body.meta.warnings }
    );
  }
 
  if (!Array.isArray(body.data) || body.data.length === 0 || !body.data[0]?.id) {
    logger.error("channex_unexpected_response", { correlationId });
    throw new AppError(
      "CHANNEX_UNEXPECTED_RESPONSE",
      502,
      "Channex returned an unexpected response while creating the property."
    );
  }

  return body;
}

export async function createChannexRoomType(
  payload: ChannexRoomTypeCreateRequest,
  correlationId: string
): Promise<ChannexRoomTypeCreateResponse> {
  const startedAt = Date.now();
  let httpStatus = 0;

  let response;
  try {
    response = await channexHttp.post<ChannexRoomTypeCreateResponse>(
      CREATE_ROOM_TYPE_ENDPOINT,
      payload
    );
    httpStatus = response.status;
  } catch (err) {
    const axiosErr = err as AxiosError;
    httpStatus = axiosErr.response?.status ?? 0;
    await logApiCall({
      method: "POST",
      endpoint: CREATE_ROOM_TYPE_ENDPOINT,
      httpStatus,
      latencyMs: Date.now() - startedAt,
    });
    throw toChannexError(err, correlationId);
  }

  await logApiCall({
    method: "POST",
    endpoint: CREATE_ROOM_TYPE_ENDPOINT,
    httpStatus,
    latencyMs: Date.now() - startedAt,
  });

  const body = response.data;

  // Channex may return one created resource as an object or as a one-item array.
  // Normalize both forms so the onboarding service has one stable response shape.
  if (body && !Array.isArray(body.data) && body.data) {
    body.data = [body.data];
  }

  // A 200/201 from Channex can still carry row-level failures in meta.warnings - per
  // the integration requirements this must NOT be treated as success.
  if (body.meta?.warnings && body.meta.warnings.length > 0) {
    logger.warn("channex_warnings_on_create", {
      correlationId,
      warningCount: body.meta.warnings.length,
    });
    throw new AppError(
      "CHANNEX_WARNINGS",
      422,
      "Channex accepted the request but reported warnings that indicate the room type was not created correctly.",
      { warnings: body.meta.warnings }
    );
  }

  if (!Array.isArray(body.data) || body.data.length === 0 || !body.data[0]?.id) {
    logger.error("channex_unexpected_response", { correlationId });
    throw new AppError(
      "CHANNEX_UNEXPECTED_RESPONSE",
      502,
      "Channex returned an unexpected response while creating the room type."
    );
  }

  return body;
}

export async function createChannexRatePlan(
  payload: ChannexRatePlanCreateRequest,
  correlationId: string
): Promise<ChannexRatePlanCreateResponse> {
  const startedAt = Date.now();
  let httpStatus = 0;

  let response;
  try {
    response = await channexHttp.post<ChannexRatePlanCreateResponse>(
      CREATE_RATE_PLAN_ENDPOINT,
      payload
    );
    httpStatus = response.status;
  } catch (err) {
    const axiosErr = err as AxiosError;
    httpStatus = axiosErr.response?.status ?? 0;
    await logApiCall({
      method: "POST",
      endpoint: CREATE_RATE_PLAN_ENDPOINT,
      httpStatus,
      latencyMs: Date.now() - startedAt,
    });
    throw toChannexError(err, correlationId);
  }

  await logApiCall({
    method: "POST",
    endpoint: CREATE_RATE_PLAN_ENDPOINT,
    httpStatus,
    latencyMs: Date.now() - startedAt,
  });

  const body = response.data;

  // Channex may return one created resource as an object or as a one-item array.
  // Normalize both forms so the onboarding service has one stable response shape.
  if (body && !Array.isArray(body.data) && body.data) {
    body.data = [body.data];
  }

  // A 200/201 from Channex can still carry row-level failures in meta.warnings - per
  // the integration requirements this must NOT be treated as success.
  if (body.meta?.warnings && body.meta.warnings.length > 0) {
    logger.warn("channex_warnings_on_create", {
      correlationId,
      warningCount: body.meta.warnings.length,
    });
    throw new AppError(
      "CHANNEX_WARNINGS",
      422,
      "Channex accepted the request but reported warnings that indicate the rate plan was not created correctly.",
      { warnings: body.meta.warnings }
    );
  }

  if (!Array.isArray(body.data) || body.data.length === 0 || !body.data[0]?.id) {
    logger.error("channex_unexpected_response", { correlationId });
    throw new AppError(
      "CHANNEX_UNEXPECTED_RESPONSE",
      502,
      "Channex returned an unexpected response while creating the rate plan."
    );
  }

  return body;
}

/**
 * Shared by both ARI push functions below - they hit different endpoints but share the
 * exact same envelope handling (task response + meta.warnings-as-failure) already
 * established by the create* functions above, so it is factored out once here rather
 * than duplicated a fourth time.
 */
async function postAriPush(
  endpoint: string,
  payload: ChannexAvailabilityPushRequest | ChannexRestrictionsPushRequest,
  correlationId: string,
  resourceLabel: string
): Promise<ChannexAriPushResponse> {
  const startedAt = Date.now();
  let httpStatus = 0;

  let response;
  try {
    response = await channexHttp.post<ChannexAriPushResponse>(endpoint, payload);
    httpStatus = response.status;
  } catch (err) {
    const axiosErr = err as AxiosError;
    httpStatus = axiosErr.response?.status ?? 0;
    await logApiCall({
      method: "POST",
      endpoint,
      httpStatus,
      latencyMs: Date.now() - startedAt,
    });
    throw toChannexError(err, correlationId);
  }

  await logApiCall({
    method: "POST",
    endpoint,
    httpStatus,
    latencyMs: Date.now() - startedAt,
  });

  const body = response.data;

  // Per this phase's explicit requirement ("handle meta.warnings as failures") - ARI
  // pushes accept a batch of (date, room_type/rate_plan) rows, and Channex reports
  // per-row rejections here even when the overall HTTP call succeeds.
  if (body.meta?.warnings && body.meta.warnings.length > 0) {
    logger.warn("channex_warnings_on_ari_push", {
      correlationId,
      resourceLabel,
      warningCount: body.meta.warnings.length,
    });
    throw new AppError(
      "CHANNEX_WARNINGS",
      422,
      `Channex accepted the ${resourceLabel} push but reported warnings for one or more rows.`,
      { warnings: body.meta.warnings }
    );
  }

  if (!Array.isArray(body.data) || body.data.length === 0 || !body.data[0]?.id) {
    logger.error("channex_unexpected_response", { correlationId, resourceLabel });
    throw new AppError(
      "CHANNEX_UNEXPECTED_RESPONSE",
      502,
      `Channex returned an unexpected response while pushing ${resourceLabel}.`
    );
  }

  return body;
}

/** Pushes availability values to Channex's POST /api/v1/availability. */
export async function pushChannexAvailability(
  payload: ChannexAvailabilityPushRequest,
  correlationId: string
): Promise<ChannexAriPushResponse> {
  return postAriPush(PUSH_AVAILABILITY_ENDPOINT, payload, correlationId, "availability");
}

/** Pushes rates/restrictions to Channex's POST /api/v1/restrictions. */
export async function pushChannexRestrictions(
  payload: ChannexRestrictionsPushRequest,
  correlationId: string
): Promise<ChannexAriPushResponse> {
  return postAriPush(PUSH_RESTRICTIONS_ENDPOINT, payload, correlationId, "restrictions");
}

/**
 * Reads back current availability from Channex's GET /api/v1/availability
 * (docs.channex.io "Availability and Rates"). Used right after a push to confirm the
 * values actually landed, since Channex documents no endpoint to poll an ARI push's
 * task id by status.
 */
export async function getChannexAvailability(
  cxPropertyId: string,
  dateFrom: string,
  dateTo: string,
  correlationId: string
): Promise<ChannexAvailabilityReadResponse> {
  try {
    const response = await channexHttp.get<ChannexAvailabilityReadResponse>(READ_AVAILABILITY_ENDPOINT, {
      params: {
        "filter[property_id]": cxPropertyId,
        "filter[date][gte]": dateFrom,
        "filter[date][lte]": dateTo,
      },
    });
    return response.data;
  } catch (err) {
    throw toChannexError(err, correlationId);
  }
}

/** All restriction fields Channex can report, per docs.channex.io - always requested so a confirmation read never misses a field that was actually pushed. */
const ALL_RESTRICTION_FIELDS =
  "rate,availability,min_stay_arrival,min_stay_through,min_stay,max_stay,closed_to_arrival,closed_to_departure,stop_sell";

/**
 * Reads back current restrictions from Channex's GET /api/v1/restrictions
 * (docs.channex.io "Availability and Rates"). Used right after a push to confirm the
 * values actually landed, since Channex documents no endpoint to poll an ARI push's
 * task id by status.
 */
export async function getChannexRestrictions(
  cxPropertyId: string,
  dateFrom: string,
  dateTo: string,
  correlationId: string
): Promise<ChannexRestrictionsReadResponse> {
  try {
    const response = await channexHttp.get<ChannexRestrictionsReadResponse>(READ_RESTRICTIONS_ENDPOINT, {
      params: {
        "filter[property_id]": cxPropertyId,
        "filter[date][gte]": dateFrom,
        "filter[date][lte]": dateTo,
        "filter[restrictions]": ALL_RESTRICTION_FIELDS,
      },
    });
    return response.data;
  } catch (err) {
    throw toChannexError(err, correlationId);
  }
}
