import axios, { AxiosError, AxiosInstance } from "axios";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { logApiCall } from "../../repositories/gqApiLog.repository";
import { logger } from "../../services/logger";
import {
  ChannexPropertyCreateRequest,
  ChannexPropertyCreateResponse,
  ChannexRatePlanCreateRequest,
  ChannexRatePlanCreateResponse,
  ChannexRoomTypeCreateRequest,
  ChannexRoomTypeCreateResponse,
} from "./channex.types";

const CREATE_PROPERTY_ENDPOINT = "/properties";
const CREATE_ROOM_TYPE_ENDPOINT = "/room_types";
const CREATE_RATE_PLAN_ENDPOINT = "/rate_plans";

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
