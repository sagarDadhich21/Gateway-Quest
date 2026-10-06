import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { logApiCall } from "../../repositories/gqApiLog.repository";
import { logger } from "../../services/logger";
import {
  ChannexAriPushResponse,
  ChannexAvailabilityPushRequest,
  ChannexAvailabilityReadResponse,
  ChannexBookingDetailResponse,
  ChannexBookingRevisionFeedResponse,
  ChannexChannelActionResponse,
  ChannexChannelDetailResponse,
  ChannexChannelListResponse,
  ChannexOneTimeTokenRequest,
  ChannexOneTimeTokenResponse,
  ChannexPropertyCreateRequest,
  ChannexPropertyCreateResponse,
  ChannexRatePlanCreateRequest,
  ChannexRatePlanCreateResponse,
  ChannexRestrictionsPushRequest,
  ChannexRestrictionsReadResponse,
  ChannexRoomTypeCreateRequest,
  ChannexRoomTypeCreateResponse,
  ChannexWebhookCreateRequest,
  ChannexWebhookCreateResponse,
  ChannexWebhookListResponse,
  ChannexWebhookUpdateRequest,
  ChannexWebhookUpdateResponse,
} from "./channex.types";

const CREATE_PROPERTY_ENDPOINT = "/properties";
const CREATE_ROOM_TYPE_ENDPOINT = "/room_types";
const CREATE_RATE_PLAN_ENDPOINT = "/rate_plans";
const PUSH_AVAILABILITY_ENDPOINT = "/availability";
const PUSH_RESTRICTIONS_ENDPOINT = "/restrictions";
const READ_AVAILABILITY_ENDPOINT = "/availability";
const READ_RESTRICTIONS_ENDPOINT = "/restrictions";
const CHANNELS_ENDPOINT = "/channels";
const ONE_TIME_TOKEN_ENDPOINT = "/auth/one_time_token";
const WEBHOOKS_CREATE_ENDPOINT = "/webhooks";

const channexHttp: AxiosInstance = axios.create({
  baseURL: env.CHANNEX_BASE_URL,
  timeout: env.UPSTREAM_TIMEOUT_MS,
  headers: {
    // Confirmed header name/format from docs.channex.io - not `Authorization: Bearer`.
    "user-api-key": env.CHANNEX_API_KEY,
    "Content-Type": "application/json",
  },
});

declare module "axios" {
  export interface InternalAxiosRequestConfig {
    _gqStartedAt?: number;
  }
}

const SENSITIVE_KEYS = new Set([
  "api_key",
  "user-api-key",
  "apikey",
  "password",
  "secret",
  "token",
  "cvv",
  "card_number",
  "authorization",
]);

/**
 * Recursively masks known sensitive field names before anything is persisted to
 * gq_api_log - defense in depth on top of Channex's own partial card masking (e.g.
 * "524181******0000"), never a substitute for it.
 */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? "[redacted]" : redact(val);
    }
    return out;
  }
  return value;
}

/**
 * Every request/response GQ exchanges with Channex, logged once here rather than
 * repeated at each of the ~20 call sites below (which used to each track their own
 * startedAt/httpStatus purely to call this manually, on both the success and error
 * path - removed in favor of these two interceptors). Captures query params and body
 * together as the "request", redacted the same way as the response.
 */
channexHttp.interceptors.request.use((config) => {
  config._gqStartedAt = Date.now();
  return config;
});

async function logChannexCall(config: InternalAxiosRequestConfig, httpStatus: number, responseBody: unknown): Promise<void> {
  const startedAt = config._gqStartedAt ?? Date.now();
  try {
    await logApiCall({
      method: (config.method ?? "get").toUpperCase(),
      endpoint: config.url ?? "",
      httpStatus,
      latencyMs: Date.now() - startedAt,
      requestBody: redact({ params: config.params, body: config.data }),
      responseBody: redact(responseBody),
    });
  } catch (err) {
    logger.error("api_log_write_failed", { message: err instanceof Error ? err.message : String(err) });
  }
}

channexHttp.interceptors.response.use(
  (response) => {
    void logChannexCall(response.config, response.status, response.data);
    return response;
  },
  (error: AxiosError) => {
    if (error.config) {
      void logChannexCall(error.config, error.response?.status ?? 0, error.response?.data);
    }
    return Promise.reject(error);
  }
);

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
  let response;
  try {
    response = await channexHttp.post<ChannexPropertyCreateResponse>(
      CREATE_PROPERTY_ENDPOINT,
      payload
    );
  } catch (err) {
    throw toChannexError(err, correlationId);
  }

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
  let response;
  try {
    response = await channexHttp.post<ChannexRoomTypeCreateResponse>(
      CREATE_ROOM_TYPE_ENDPOINT,
      payload
    );
  } catch (err) {
    throw toChannexError(err, correlationId);
  }

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
  let response;
  try {
    response = await channexHttp.post<ChannexRatePlanCreateResponse>(
      CREATE_RATE_PLAN_ENDPOINT,
      payload
    );
  } catch (err) {
    throw toChannexError(err, correlationId);
  }

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
  let response;
  try {
    response = await channexHttp.post<ChannexAriPushResponse>(endpoint, payload);
  } catch (err) {
    throw toChannexError(err, correlationId);
  }

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

/** Lists a property's connected channels (GET /channels?filter[property_id]=...). */
export async function listChannexChannels(
  cxPropertyId: string,
  correlationId: string
): Promise<ChannexChannelListResponse> {
  try {
    const response = await channexHttp.get<ChannexChannelListResponse>(CHANNELS_ENDPOINT, {
      params: { "filter[property_id]": cxPropertyId },
    });
    return response.data;
  } catch (err) {
    throw toChannexError(err, correlationId);
  }
}

/** One channel's details, including known_mappings - the only way to read room/rate mappings a property owner set up in Channex's own mapping screen. */
export async function getChannexChannel(
  cxChannelId: string,
  correlationId: string
): Promise<ChannexChannelDetailResponse> {
  const endpoint = `${CHANNELS_ENDPOINT}/${cxChannelId}`;
  try {
    const response = await channexHttp.get<ChannexChannelDetailResponse>(endpoint);
    return response.data;
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.status === 404) {
      throw new AppError(
        "CHANNEL_NOT_FOUND",
        404,
        "This channel no longer exists on Channex - it was likely removed there directly, outside of GQ."
      );
    }
    throw toChannexError(err, correlationId);
  }
}

/**
 * Confirmed live against Channex staging: this endpoint returns only
 * `{"meta":{"message":"Success"}}` on success, never the updated channel resource
 * (despite what the docs summary implied) - callers get a confirmation, not a body to
 * read `is_active`/etc. from.
 */
async function setChannexChannelActive(
  cxChannelId: string,
  active: boolean,
  correlationId: string
): Promise<ChannexChannelActionResponse> {
  const endpoint = `${CHANNELS_ENDPOINT}/${cxChannelId}/${active ? "activate" : "deactivate"}`;
  try {
    const response = await channexHttp.post<ChannexChannelActionResponse>(endpoint);
    return response.data;
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.status === 404) {
      throw new AppError(
        "CHANNEL_NOT_FOUND",
        404,
        "This channel no longer exists on Channex - it was likely removed there directly, outside of GQ."
      );
    }
    throw toChannexError(err, correlationId);
  }
}

/** POST /channels/{id}/activate. */
export async function activateChannexChannel(cxChannelId: string, correlationId: string): Promise<ChannexChannelActionResponse> {
  return setChannexChannelActive(cxChannelId, true, correlationId);
}

/** POST /channels/{id}/deactivate. */
export async function deactivateChannexChannel(cxChannelId: string, correlationId: string): Promise<ChannexChannelActionResponse> {
  return setChannexChannelActive(cxChannelId, false, correlationId);
}

/**
 * POST /auth/one_time_token - the only Channex-issued credential for launching the
 * hosted IFrame "mapping screen" (docs.channex.io/api-v.1-documentation/
 * channel-iframe). Valid for 15 minutes and single-use; Channex has no other API for
 * configuring room/rate mappings, so this is how GQ hands the property owner off to
 * Channex's own UI to do it.
 */
export async function createChannexOneTimeToken(
  payload: ChannexOneTimeTokenRequest,
  correlationId: string
): Promise<ChannexOneTimeTokenResponse> {
  try {
    const response = await channexHttp.post<ChannexOneTimeTokenResponse>(ONE_TIME_TOKEN_ENDPOINT, payload);
    return response.data;
  } catch (err) {
    throw toChannexError(err, correlationId);
  }
}

/**
 * POST /webhooks - the real registration call this whole flow used to require doing by
 * hand (curl/Postman) against Channex directly. See accountConfig.service.ts's
 * registerAccountConfigWithChannex() for how the shared-secret header actually gets
 * attached.
 */
export async function createChannexWebhook(
  payload: ChannexWebhookCreateRequest,
  correlationId: string
): Promise<ChannexWebhookCreateResponse> {
  try {
    const response = await channexHttp.post<ChannexWebhookCreateResponse>(WEBHOOKS_CREATE_ENDPOINT, payload);
    return response.data;
  } catch (err) {
    throw toChannexError(err, correlationId);
  }
}

/** GET /webhooks - see ChannexWebhookListResponse for why registerAccountConfigWithChannex() needs this. */
export async function listChannexWebhooks(correlationId: string): Promise<ChannexWebhookListResponse> {
  try {
    const response = await channexHttp.get<ChannexWebhookListResponse>(WEBHOOKS_CREATE_ENDPOINT, {
      params: { "pagination[limit]": 100 },
    });
    return response.data;
  } catch (err) {
    throw toChannexError(err, correlationId);
  }
}

/** PUT /webhooks/{id} - updates an existing registration in place (url, secret header, active/send_data flags). */
export async function updateChannexWebhook(
  cxWebhookId: string,
  payload: ChannexWebhookUpdateRequest,
  correlationId: string
): Promise<ChannexWebhookUpdateResponse> {
  try {
    const response = await channexHttp.put<ChannexWebhookUpdateResponse>(
      `${WEBHOOKS_CREATE_ENDPOINT}/${cxWebhookId}`,
      payload
    );
    return response.data;
  } catch (err) {
    throw toChannexError(err, correlationId);
  }
}

const REVISION_FEED_ENDPOINT = "/booking_revisions/feed";
const BOOKINGS_ENDPOINT = "/bookings";

/**
 * GET /booking_revisions/feed - the fallback/recovery read for missed webhooks
 * (docs.channex.io/api-v.1-documentation/bookings-collection). Paginated; callers loop
 * pages themselves (see scripts/run-revision-feed.ts).
 */
export async function getChannexRevisionFeed(
  cxPropertyId: string | undefined,
  page: number,
  limit: number,
  correlationId: string
): Promise<ChannexBookingRevisionFeedResponse> {
  try {
    const response = await channexHttp.get<ChannexBookingRevisionFeedResponse>(REVISION_FEED_ENDPOINT, {
      params: {
        "filter[property_id]": cxPropertyId,
        "pagination[page]": page,
        "pagination[limit]": limit,
        "order[inserted_at]": "asc",
      },
    });
    return response.data;
  } catch (err) {
    throw toChannexError(err, correlationId);
  }
}

/** GET /bookings/:id - full reservation detail for one Channex booking id (webhook payloads only carry the id, not the content). */
/**
 * GET /bookings/:id's `attributes.id` is the BOOKING's id, not the revision's - the
 * real revision id is the separate `attributes.revision_id` field (confirmed live
 * 2026-10-01, see the doc comment on ChannexBookingRevisionAttributes). Normalized
 * here, once, so every caller of getChannexBooking() can keep treating `.id` as "the
 * revision id" exactly like a revision-feed entry, without needing to know which
 * endpoint it came from.
 */
export function normalizeBookingDetailResponse(body: ChannexBookingDetailResponse): ChannexBookingDetailResponse {
  const attrs = body.data.attributes;
  if (!attrs.revision_id || attrs.revision_id === attrs.id) {
    return body;
  }
  return { ...body, data: { ...body.data, attributes: { ...attrs, id: attrs.revision_id } } };
}

export async function getChannexBooking(
  cxBookingId: string,
  correlationId: string
): Promise<ChannexBookingDetailResponse> {
  const endpoint = `${BOOKINGS_ENDPOINT}/${cxBookingId}`;
  try {
    const response = await channexHttp.get<ChannexBookingDetailResponse>(endpoint);
    return normalizeBookingDetailResponse(response.data);
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.status === 404) {
      throw new AppError("BOOKING_NOT_FOUND", 404, "Booking not found on Channex.");
    }
    throw toChannexError(err, correlationId);
  }
}

/** POST /booking_revisions/{id}/ack - marks a revision processed; per Channex's docs this removes it from the feed, not confirmed to affect webhook redelivery. */
export async function ackChannexRevision(cxRevisionId: string, correlationId: string): Promise<void> {
  const endpoint = `${REVISION_FEED_ENDPOINT.replace("/feed", "")}/${cxRevisionId}/ack`;
  try {
    await channexHttp.post(endpoint);
  } catch (err) {
    throw toChannexError(err, correlationId);
  }
}
