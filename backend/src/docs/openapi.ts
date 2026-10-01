import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { createAccountConfigSchema } from "../modules/accountConfig/accountConfig.schema";
import { loginRequestSchema } from "../modules/auth/auth.schema";
import {
  bookingIdParamSchema,
  bookingRevisionIdParamSchema,
  listBookingRevisionsQuerySchema,
  listBookingsQuerySchema,
} from "../modules/booking/booking.schema";
import { channelIdParamSchema, channelMappingIdParamSchema, generateConnectionTokenSchema } from "../modules/channel/channel.schema";
import { propertyIdParamSchema } from "../modules/property/property.schema";
import {
  createRatePlanSchema,
  listRatePlansQuerySchema,
  ratePlanIdParamSchema,
} from "../modules/ratePlan/ratePlan.schema";
import { pushAvailabilitySchema } from "../modules/ari/ari.schema";

/**
 * GQ's own OpenAPI/Swagger doc, generated from the same Zod schemas that already
 * validate every request (see each module's *.schema.ts) - not hand-written and not
 * auto-generated for free the way the FastAPI services (bq/eq/pricing-service) get it,
 * since Express has no built-in equivalent. Response shapes below are written fresh
 * here, matching each module's *.dto.ts exactly, since those are plain TS interfaces
 * (not Zod schemas) and have nothing to generate from directly.
 *
 * A few request schemas use `.refine()` (ariDateRangeQuerySchema, updateRatePlanSchema,
 * pushRestrictionsSchema's per-value refinement) - OpenAPI has no way to express a
 * cross-field refinement anyway, so those are represented here by an equivalent plain
 * object schema (same shape, no refine) built locally rather than importing the refined
 * export, purely so the generator has a schema it can render - the real validation
 * still only ever happens via the actual exported schemas in each *.schema.ts.
 */
extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Token from POST /auth/login. GQ's own session token - never a BQ/EQ token.",
});

registry.registerComponent("securitySchemes", "webhookSecret", {
  type: "apiKey",
  in: "header",
  name: "x-channex-webhook-secret",
  description:
    "Shared secret configured when the webhook was registered with Channex (POST /webhooks, `headers` field) - Channex documents no cryptographic signature scheme, this header comparison is the complete verification available.",
});

const AUTH = [{ bearerAuth: [] }];
const WEBHOOK_AUTH = [{ webhookSecret: [] }];

// ---------- Shared error envelope (see middleware/errorHandler.ts) ----------

const errorEnvelopeSchema = registry.register(
  "ErrorEnvelope",
  z.object({
    error: z.object({
      code: z.string().openapi({ example: "VALIDATION_ERROR" }),
      message: z.string(),
      details: z.unknown().optional(),
      correlationId: z.string().uuid(),
    }),
  })
);

function errorResponse(description: string) {
  return { description, content: { "application/json": { schema: errorEnvelopeSchema } } };
}

// ---------- Auth ----------

registry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  summary: "Log in",
  description: "Authenticates against EQ/AQ's existing login API and, on success, issues GQ's own session token.",
  request: { body: { content: { "application/json": { schema: loginRequestSchema } } } },
  responses: {
    200: {
      description: "Login succeeded",
      content: {
        "application/json": {
          schema: registry.register(
            "LoginResponse",
            z.object({
              token: z.string(),
              expiresInMinutes: z.number().int(),
              user: z.object({
                id: z.string().uuid(),
                bqUserId: z.number().int(),
                propertyId: z.number().int().nullable(),
                roles: z.array(z.string()),
              }),
            })
          ),
        },
      },
    },
    401: errorResponse("Invalid credentials, MFA required, property registration required, or email verification required"),
    422: errorResponse("Request validation failed"),
  },
});

// ---------- Property ----------

const propertyResponseSchema = registry.register(
  "PropertyResponse",
  z.object({
    id: z.number().int(),
    name: z.string(),
    city: z.string(),
    location: z.string(),
    address: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    currency: z.string().nullable(),
    country: z.string().nullable(),
    state: z.string().nullable(),
    zipCode: z.string().nullable(),
    timeZone: z.string().nullable(),
    channex: z.object({ onboarded: z.boolean(), propertyId: z.string().nullable() }),
  })
);

const roomTypeSummarySchema = registry.register(
  "RoomTypeSummary",
  z.object({
    id: z.number().int(),
    name: z.string(),
    maxOccupancy: z.number().int(),
    totalRooms: z.number().int(),
    channex: z.object({ onboarded: z.boolean(), roomTypeId: z.string().nullable() }),
  })
);

const roomTypeOnboardResultSchema = registry.register(
  "RoomTypeOnboardResult",
  z.object({
    roomTypeId: z.number().int(),
    cxRoomTypeId: z.string(),
    status: z.enum(["onboarded", "already_onboarded"]),
  })
);

registry.registerPath({
  method: "get",
  path: "/properties/{propertyId}",
  tags: ["Property"],
  summary: "Get a property",
  security: AUTH,
  request: { params: propertyIdParamSchema },
  responses: {
    200: { description: "Property details", content: { "application/json": { schema: propertyResponseSchema } } },
    403: errorResponse("You do not have access to this property"),
    404: errorResponse("Property not found"),
  },
});

registry.registerPath({
  method: "post",
  path: "/properties/{propertyId}/onboard",
  tags: ["Property"],
  summary: "Onboard a property to Channex",
  description: "Idempotent - returns 200 if already onboarded, 201 if newly created on Channex.",
  security: AUTH,
  request: { params: propertyIdParamSchema },
  responses: {
    200: { description: "Already onboarded", content: { "application/json": { schema: z.object({ propertyId: z.number().int(), channexPropertyId: z.string(), status: z.literal("already_onboarded") }) } } },
    201: { description: "Newly onboarded", content: { "application/json": { schema: z.object({ propertyId: z.number().int(), channexPropertyId: z.string(), status: z.literal("onboarded") }) } } },
    422: errorResponse("Property is missing fields Channex requires"),
  },
});

registry.registerPath({
  method: "get",
  path: "/properties/{propertyId}/room-types",
  tags: ["Property"],
  summary: "List a property's BQ room types",
  security: AUTH,
  request: { params: propertyIdParamSchema },
  responses: {
    200: {
      description: "Room types with Channex onboarding status",
      content: { "application/json": { schema: z.object({ roomTypes: z.array(roomTypeSummarySchema) }) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/properties/{propertyId}/room-types/onboard",
  tags: ["Property"],
  summary: "Onboard all unmapped room types to Channex",
  description: "Idempotent per room type - skips ones that already carry a cx_room_type_id.",
  security: AUTH,
  request: { params: propertyIdParamSchema },
  responses: {
    200: {
      description: "Per-room-type onboarding results",
      content: { "application/json": { schema: z.object({ roomTypes: z.array(roomTypeOnboardResultSchema) }) } },
    },
    422: errorResponse("Property not onboarded, or a room type has no physical rooms"),
  },
});

// ---------- Rate plans ----------

const ratePlanOptionSchema = z.object({
  id: z.string().uuid(),
  occupancy: z.number().int(),
  isPrimary: z.boolean(),
  rate: z.number().int().nullable(),
});

const ratePlanResponseSchema = registry.register(
  "RatePlanResponse",
  z.object({
    id: z.string().uuid(),
    propertyId: z.number().int(),
    roomTypeId: z.number().int(),
    name: z.string(),
    currency: z.string(),
    sellMode: z.string(),
    rateMode: z.string(),
    mealType: z.string().nullable(),
    parentRatePlanId: z.string().uuid().nullable(),
    isDefault: z.boolean(),
    channex: z.object({ onboarded: z.boolean(), ratePlanId: z.string().nullable() }),
    options: z.array(ratePlanOptionSchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
);

registry.registerPath({
  method: "get",
  path: "/rate-plans",
  tags: ["Rate plans"],
  summary: "List rate plans",
  description: "propertyId defaults to the caller's own assigned property when omitted.",
  security: AUTH,
  request: { query: listRatePlansQuerySchema },
  responses: {
    200: { description: "Rate plans", content: { "application/json": { schema: z.object({ ratePlans: z.array(ratePlanResponseSchema) }) } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/rate-plans/{ratePlanId}",
  tags: ["Rate plans"],
  summary: "Get a rate plan",
  security: AUTH,
  request: { params: ratePlanIdParamSchema },
  responses: {
    200: { description: "Rate plan", content: { "application/json": { schema: ratePlanResponseSchema } } },
    404: errorResponse("Rate plan not found"),
  },
});

registry.registerPath({
  method: "post",
  path: "/rate-plans",
  tags: ["Rate plans"],
  summary: "Create a rate plan (and onboard it to Channex)",
  description: "Idempotent by (roomTypeId, name) - a second call with the same pair returns the existing rate plan (200) instead of creating a duplicate (201).",
  security: AUTH,
  request: { body: { content: { "application/json": { schema: createRatePlanSchema } } } },
  responses: {
    200: { description: "Already existed", content: { "application/json": { schema: ratePlanResponseSchema } } },
    201: { description: "Newly created and onboarded", content: { "application/json": { schema: ratePlanResponseSchema } } },
    422: errorResponse("Property/room type not onboarded, or occupancy exceeds the room type's max"),
  },
});

registry.registerPath({
  method: "put",
  path: "/rate-plans/{ratePlanId}",
  tags: ["Rate plans"],
  summary: "Update a rate plan",
  description: "Updates local GQ fields only - there is no confirmed Channex rate-plan update endpoint, so changes are not pushed to Channex.",
  security: AUTH,
  request: {
    params: ratePlanIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().min(1).optional(),
            currency: z.string().length(3).optional(),
            sellMode: z.enum(["per_room", "per_person"]).optional(),
            rateMode: z.enum(["manual", "derived", "auto", "cascade"]).optional(),
            mealType: z.string().min(1).optional(),
            isDefault: z.boolean().optional(),
            options: z.array(z.object({ occupancy: z.number().int().positive(), isPrimary: z.boolean().optional() })).optional(),
          }).openapi({ description: "At least one field must be provided." }),
        },
      },
    },
  },
  responses: {
    200: { description: "Updated rate plan", content: { "application/json": { schema: ratePlanResponseSchema } } },
    404: errorResponse("Rate plan not found"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/rate-plans/{ratePlanId}",
  tags: ["Rate plans"],
  summary: "Delete a rate plan",
  description: "Deletes the local GQ rate plan only - the Channex-side rate plan (if any) is left in place. Fails if another rate plan inherits from this one as its parent.",
  security: AUTH,
  request: { params: ratePlanIdParamSchema },
  responses: {
    204: { description: "Deleted" },
    404: errorResponse("Rate plan not found"),
    422: errorResponse("Another rate plan inherits from this one"),
  },
});

// ---------- ARI ----------

const restrictionSchema = registry.register(
  "Restriction",
  z.object({
    ratePlanId: z.string().uuid(),
    date: z.string(),
    rate: z.number().int(),
    minStayArrival: z.number().int().nullable(),
    minStayThrough: z.number().int().nullable(),
    minStay: z.number().int().nullable(),
    maxStay: z.number().int().nullable(),
    closedToArrival: z.boolean(),
    closedToDeparture: z.boolean(),
    stopSell: z.boolean(),
    updatedAt: z.string().datetime(),
  })
);

const availabilitySnapshotSchema = registry.register(
  "AvailabilitySnapshot",
  z.object({
    roomTypeId: z.number().int(),
    date: z.string(),
    availableRooms: z.number().int(),
    updatedAt: z.string().datetime(),
  })
);

const dailyAvailabilitySchema = registry.register(
  "DailyAvailability",
  z.object({
    roomTypeId: z.number().int(),
    date: z.string(),
    totalRooms: z.number().int(),
    bookedRooms: z.number().int(),
    availableRooms: z.number().int(),
  })
);

// Plain (non-refined) equivalent of ariDateRangeQuerySchema, for documentation only -
// the real validation, including the dateFrom<=dateTo check, still only happens via
// the actual exported schema in ari.schema.ts.
const ariDateRangeQueryDocSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).openapi({ example: "2026-09-23" }),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).openapi({ example: "2026-09-29" }),
  roomTypeId: z.coerce.number().int().positive().optional(),
});

registry.registerPath({
  method: "get",
  path: "/properties/{propertyId}/ari",
  tags: ["ARI"],
  summary: "Get GQ's last-known restrictions + availability",
  description: "Reads GQ's own persisted state (what was last pushed), not a live upstream read - see GET /ari/availability for that.",
  security: AUTH,
  request: { params: propertyIdParamSchema, query: ariDateRangeQueryDocSchema },
  responses: {
    200: {
      description: "Last-known ARI snapshot",
      content: { "application/json": { schema: z.object({ restrictions: z.array(restrictionSchema), availability: z.array(availabilitySnapshotSchema) }) } },
    },
    422: errorResponse("Invalid date range"),
  },
});

registry.registerPath({
  method: "get",
  path: "/properties/{propertyId}/ari/availability",
  tags: ["ARI"],
  summary: "Get real, live availability from BQ",
  security: AUTH,
  request: { params: propertyIdParamSchema, query: ariDateRangeQueryDocSchema },
  responses: {
    200: { description: "Live BQ availability", content: { "application/json": { schema: z.object({ availability: z.array(dailyAvailabilitySchema) }) } } },
    422: errorResponse("Invalid date range"),
  },
});

registry.registerPath({
  method: "post",
  path: "/properties/{propertyId}/ari/availability",
  tags: ["ARI"],
  summary: "Push availability to Channex",
  description: "Every room type must already be mapped to Channex, and every value is oversell-guarded against BQ's physical room count before anything is sent.",
  security: AUTH,
  request: { params: propertyIdParamSchema, body: { content: { "application/json": { schema: pushAvailabilitySchema } } } },
  responses: {
    200: {
      description: "Pushed (see `verified` for whether Channex's read-back confirmed it)",
      content: {
        "application/json": {
          schema: z.object({
            cxTaskId: z.string(),
            verified: z.boolean(),
            snapshots: z.array(availabilitySnapshotSchema),
          }),
        },
      },
    },
    422: errorResponse("Unmapped room type(s), oversell guard tripped, or Channex returned row-level warnings"),
  },
});

// Plain (non-refined) equivalent of pushRestrictionsSchema, for documentation only.
const pushRestrictionsDocSchema = z.object({
  ratePlanId: z.string().uuid(),
  values: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      rate: z.number().positive().optional().openapi({ description: "Major currency units (e.g. 3999.00). Omit to fall back to pricing-service for that date." }),
      minStayArrival: z.number().int().positive().optional(),
      minStayThrough: z.number().int().positive().optional(),
      minStay: z.number().int().positive().optional().openapi({ description: "Shorthand - applied as both minStayArrival and minStayThrough unless those are set explicitly. Never sent to Channex as `min_stay` directly." }),
      maxStay: z.number().int().positive().optional(),
      closedToArrival: z.boolean().optional(),
      closedToDeparture: z.boolean().optional(),
      stopSell: z.boolean().optional(),
    }).openapi({ description: "At least one field besides date must be set." })
  ).min(1),
});

registry.registerPath({
  method: "post",
  path: "/properties/{propertyId}/ari/restrictions",
  tags: ["ARI"],
  summary: "Push rates/restrictions to Channex",
  description: "The rate plan must already be mapped to Channex. rate is validated > 0 (explicit or from pricing-service) before pushing.",
  security: AUTH,
  request: { params: propertyIdParamSchema, body: { content: { "application/json": { schema: pushRestrictionsDocSchema } } } },
  responses: {
    200: {
      description: "Pushed (see `verified` for whether Channex's read-back confirmed it)",
      content: {
        "application/json": {
          schema: z.object({
            cxTaskId: z.string(),
            verified: z.boolean(),
            restrictions: z.array(restrictionSchema),
          }),
        },
      },
    },
    422: errorResponse("Rate plan not onboarded, missing price with no pricing-service fallback, or Channex returned row-level warnings"),
  },
});

// ---------- Channels & OTA mapping ----------

const channelResponseSchema = registry.register(
  "ChannelResponse",
  z.object({
    id: z.string().uuid(),
    propertyId: z.number().int(),
    title: z.string(),
    channel: z.string(),
    currency: z.string().nullable(),
    isActive: z.boolean(),
    channex: z.object({ channelId: z.string().uuid() }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
);

const channelMappingResponseSchema = registry.register(
  "ChannelMappingResponse",
  z.object({
    id: z.string().uuid(),
    channelId: z.string().uuid(),
    roomTypeId: z.number().int(),
    ratePlanId: z.string().uuid(),
    otaRoomCode: z.string(),
    otaRateCode: z.string(),
    channex: z.object({ mappingId: z.string().uuid() }),
  })
);

const connectionTokenResponseSchema = registry.register(
  "ConnectionTokenResponse",
  z.object({
    token: z.string(),
    iframeUrl: z.string().url(),
    expiresInMinutes: z.literal(15),
  })
);

registry.registerPath({
  method: "get",
  path: "/properties/{propertyId}/channels",
  tags: ["Channels"],
  summary: "List a property's connected channels",
  description: "Calls Channex's GET /channels and syncs each one into GQ's local cache (upsert by cx_channel_id).",
  security: AUTH,
  request: { params: propertyIdParamSchema },
  responses: {
    200: { description: "Channels", content: { "application/json": { schema: z.object({ channels: z.array(channelResponseSchema) }) } } },
    422: errorResponse("Property not onboarded to Channex"),
  },
});

registry.registerPath({
  method: "post",
  path: "/properties/{propertyId}/channels/connect-token",
  tags: ["Channels"],
  summary: "Generate a Channex one-time token + IFrame URL",
  description: "Channex has no REST API to create a channel connection or configure room/rate mappings - this token unlocks Channex's own hosted IFrame UI, where the property owner does both. Token is single-use and expires in 15 minutes.",
  security: AUTH,
  request: { params: propertyIdParamSchema, body: { content: { "application/json": { schema: generateConnectionTokenSchema } } } },
  responses: {
    201: { description: "One-time token issued", content: { "application/json": { schema: connectionTokenResponseSchema } } },
    422: errorResponse("Property not onboarded to Channex"),
  },
});

registry.registerPath({
  method: "get",
  path: "/channels/{channelId}",
  tags: ["Channels"],
  summary: "Get a channel's details/status",
  security: AUTH,
  request: { params: channelIdParamSchema },
  responses: {
    200: { description: "Channel details", content: { "application/json": { schema: channelResponseSchema } } },
    404: errorResponse("Channel not found"),
  },
});

registry.registerPath({
  method: "post",
  path: "/channels/{channelId}/activate",
  tags: ["Channels"],
  summary: "Activate a channel connection",
  security: AUTH,
  request: { params: channelIdParamSchema },
  responses: {
    200: { description: "Activated", content: { "application/json": { schema: channelResponseSchema } } },
    404: errorResponse("Channel not found"),
  },
});

registry.registerPath({
  method: "post",
  path: "/channels/{channelId}/deactivate",
  tags: ["Channels"],
  summary: "Deactivate a channel connection",
  security: AUTH,
  request: { params: channelIdParamSchema },
  responses: {
    200: { description: "Deactivated", content: { "application/json": { schema: channelResponseSchema } } },
    404: errorResponse("Channel not found"),
  },
});

registry.registerPath({
  method: "get",
  path: "/channels/{channelId}/mappings",
  tags: ["Channels"],
  summary: "List (and sync) a channel's room/rate mappings",
  description:
    "Reads current mappings from Channex (known_mappings on the channel detail response) and upserts them into GQ's local cache. This doubles as create/update for mappings, since Channex has no separate write API for them - a mapping is only synced when both its room type and rate plan resolve to something GQ recognizes on this same property.",
  security: AUTH,
  request: { params: channelIdParamSchema },
  responses: {
    200: { description: "Synced mappings", content: { "application/json": { schema: z.object({ mappings: z.array(channelMappingResponseSchema) }) } } },
    404: errorResponse("Channel not found"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/channels/{channelId}/mappings/{mappingId}",
  tags: ["Channels"],
  summary: "Remove a mapping from GQ's local cache",
  description: "Removes GQ's cached copy only - Channex has no API to delete the mapping itself, which still exists on Channex's side until removed through their IFrame mapping screen. The next sync recreates this row if it's still there.",
  security: AUTH,
  request: { params: channelMappingIdParamSchema },
  responses: {
    204: { description: "Removed from GQ's local cache" },
    404: errorResponse("Channel or mapping not found"),
  },
});

// ---------- Booking ingestion (Phase 6) ----------

const otaBookingResponseSchema = registry.register(
  "OtaBookingResponse",
  z.object({
    id: z.string().uuid(),
    bqPropertyId: z.number().int(),
    cxBookingId: z.string(),
    otaName: z.string(),
    uniqueId: z.string(),
    status: z.enum(["new", "modified", "cancelled"]),
    currency: z.string(),
    bqOrderId: z.string().nullable(),
    bqBookingId: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
);

const otaBookingRevisionResponseSchema = registry.register(
  "OtaBookingRevisionResponse",
  z.object({
    id: z.string().uuid(),
    otaBookingId: z.string().uuid(),
    cxRevisionId: z.string(),
    status: z.enum(["new", "modified", "cancelled"]),
    arrivalDate: z.string().nullable(),
    departureDate: z.string().nullable(),
    amountMinorUnits: z.number().int(),
    currency: z.string(),
    guestName: z.string().nullable(),
    ackStatus: z.enum(["pending", "acked"]),
    blockingReason: z.string().nullable(),
    processingAttempts: z.number().int(),
    receivedAt: z.string().datetime(),
    ackedAt: z.string().datetime().nullable(),
  })
);

const otaBookingDetailResponseSchema = registry.register(
  "OtaBookingDetailResponse",
  otaBookingResponseSchema.extend({ revisions: z.array(otaBookingRevisionResponseSchema) })
);

registry.registerPath({
  method: "get",
  path: "/properties/{propertyId}/bookings",
  tags: ["Booking"],
  summary: "List a property's OTA bookings",
  description:
    "GQ's own persisted ingestion state (gq_ota_booking), not a live Channex read - mirrors Channex's own read-only Bookings Collection API. Bookings are only ever created by ingestion (the webhook / revision feed), never by a direct write here.",
  security: AUTH,
  request: { params: propertyIdParamSchema, query: listBookingsQuerySchema },
  responses: {
    200: { description: "Bookings", content: { "application/json": { schema: z.object({ bookings: z.array(otaBookingResponseSchema) }) } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/properties/{propertyId}/bookings/{bookingId}",
  tags: ["Booking"],
  summary: "Get one OTA booking with its full revision history",
  security: AUTH,
  request: { params: bookingIdParamSchema },
  responses: {
    200: { description: "Booking with revisions", content: { "application/json": { schema: otaBookingDetailResponseSchema } } },
    404: errorResponse("Booking not found, or belongs to a different property"),
  },
});

registry.registerPath({
  method: "get",
  path: "/properties/{propertyId}/booking-revisions",
  tags: ["Booking"],
  summary: "List revisions across every booking on a property",
  description: "Useful to find stuck/blocked revisions (see ackStatus, processingAttempts, blockingReason) without knowing a booking's id up front.",
  security: AUTH,
  request: { params: propertyIdParamSchema, query: listBookingRevisionsQuerySchema },
  responses: {
    200: { description: "Revisions", content: { "application/json": { schema: z.object({ revisions: z.array(otaBookingRevisionResponseSchema) }) } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/properties/{propertyId}/booking-revisions/{revisionId}",
  tags: ["Booking"],
  summary: "Get one booking revision",
  security: AUTH,
  request: { params: bookingRevisionIdParamSchema },
  responses: {
    200: { description: "Revision", content: { "application/json": { schema: otaBookingRevisionResponseSchema } } },
    404: errorResponse("Revision not found, or belongs to a different property"),
  },
});

registry.registerPath({
  method: "post",
  path: "/webhooks/channex",
  tags: ["Booking"],
  summary: "Channex booking webhook (public, no user JWT)",
  description:
    "Public endpoint Channex calls directly - no GQ session token. Verified via a shared-secret header instead (see the webhookSecret security scheme). Responds 200 immediately after verification, then processes the booking revision asynchronously (fire-and-forget within this process, not a queue) through the same logic scripts/run-revision-feed.ts uses for recovery.",
  security: WEBHOOK_AUTH,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            event: z.string().openapi({ example: "booking" }),
            property_id: z.string().optional(),
            payload: z
              .object({
                booking_id: z.string().optional(),
                property_id: z.string().optional(),
                revision_id: z.string().optional(),
              })
              .optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Webhook received", content: { "application/json": { schema: z.object({ received: z.boolean() }) } } },
    401: errorResponse("Missing or invalid webhook secret header"),
    422: errorResponse("Malformed webhook body"),
  },
});

// ---------- Account config (admin) ----------

const accountConfigResponseSchema = registry.register(
  "AccountConfigResponse",
  z.object({
    id: z.string().uuid(),
    bqPropertyId: z.number().int().nullable(),
    webhookUrl: z.string().url(),
    environment: z.string(),
    isActive: z.boolean(),
    sendData: z.boolean(),
    createdAt: z.string().datetime(),
  })
);

const accountConfigCreatedResponseSchema = registry.register(
  "AccountConfigCreatedResponse",
  accountConfigResponseSchema.extend({
    webhookSecret: z.string().openapi({
      description: "Only ever returned here, at creation time - use it as the `headers` value when registering the webhook with Channex, and as this endpoint's own x-channex-webhook-secret. Not retrievable again afterward.",
    }),
  })
);

registry.registerPath({
  method: "post",
  path: "/account-config",
  tags: ["Account config"],
  summary: "Create a Channex account/webhook config (admin only)",
  description:
    "Generates a random webhook_secret server-side and persists it as an active gq_account_config row - this is what POST /webhooks/channex checks incoming requests against. Requires the caller's GQ token to carry BQ's 'Super_Admin' role.",
  security: AUTH,
  request: { body: { content: { "application/json": { schema: createAccountConfigSchema } } } },
  responses: {
    201: { description: "Created - webhookSecret is shown here only", content: { "application/json": { schema: accountConfigCreatedResponseSchema } } },
    403: errorResponse("Caller's token does not carry the Super_Admin role"),
    422: errorResponse("Request validation failed"),
  },
});

registry.registerPath({
  method: "get",
  path: "/account-config",
  tags: ["Account config"],
  summary: "List Channex account/webhook configs (admin only)",
  description: "webhookSecret is never included in this response, only at creation time.",
  security: AUTH,
  responses: {
    200: { description: "Account configs", content: { "application/json": { schema: z.object({ accountConfigs: z.array(accountConfigResponseSchema) }) } } },
    403: errorResponse("Caller's token does not carry the Super_Admin role"),
  },
});

// ---------- Monitoring (admin) ----------
//
// None of these 4 tables carry a bq_property_id - Super_Admin only, same reasoning as
// account-config. gq_push_task/gq_api_log are populated by the ARI push and Channex
// client code paths respectively; gq_webhook_log/gq_error_queue are populated by the
// booking webhook route (booking.routes.ts).

const listLimitQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional().openapi({ description: "Defaults to 100, max 500." }),
});

const pushTaskResponseSchema = registry.register(
  "PushTaskResponse",
  z.object({
    id: z.string().uuid(),
    taskType: z.string(),
    cxTaskId: z.string(),
    status: z.string(),
    warnings: z.unknown().nullable(),
    createdAt: z.string().datetime(),
  })
);

const apiLogResponseSchema = registry.register(
  "ApiLogResponse",
  z.object({
    id: z.string().uuid(),
    method: z.string(),
    endpoint: z.string(),
    httpStatus: z.number().int(),
    latencyMs: z.number().int(),
    requestBody: z.unknown().nullable().openapi({ description: "Redacted (sensitive fields masked) - see channex.client.ts's redact()." }),
    responseBody: z.unknown().nullable(),
    createdAt: z.string().datetime(),
  })
);

const webhookLogResponseSchema = registry.register(
  "WebhookLogResponse",
  z.object({
    id: z.string().uuid(),
    event: z.string(),
    ref: z.string(),
    attempt: z.number().int(),
    httpStatusReturned: z.number().int().nullable(),
    receivedAt: z.string().datetime(),
    nextRetryAt: z.string().datetime().nullable(),
  })
);

const errorQueueResponseSchema = registry.register(
  "ErrorQueueResponse",
  z.object({
    id: z.string().uuid(),
    source: z.string(),
    payload: z.unknown(),
    errorMessage: z.string(),
    retryCount: z.number().int(),
    createdAt: z.string().datetime(),
  })
);

registry.registerPath({
  method: "get",
  path: "/monitoring/tasks",
  tags: ["Monitoring"],
  summary: "List Channex ARI push tasks (admin only)",
  description: "Audit trail of availability/restriction pushes - see ari.service.ts. Not property-scoped.",
  security: AUTH,
  request: { query: listLimitQuerySchema },
  responses: {
    200: { description: "Push tasks", content: { "application/json": { schema: z.object({ tasks: z.array(pushTaskResponseSchema) }) } } },
    403: errorResponse("Caller's token does not carry the Super_Admin role"),
  },
});

registry.registerPath({
  method: "get",
  path: "/monitoring/api-logs",
  tags: ["Monitoring"],
  summary: "List outbound Channex API calls (admin only)",
  description: "Every call GQ makes to Channex (channex.client.ts) - method, endpoint, status, latency. Never includes the API key or request/response bodies.",
  security: AUTH,
  request: { query: listLimitQuerySchema },
  responses: {
    200: { description: "API call log", content: { "application/json": { schema: z.object({ apiLogs: z.array(apiLogResponseSchema) }) } } },
    403: errorResponse("Caller's token does not carry the Super_Admin role"),
  },
});

registry.registerPath({
  method: "get",
  path: "/monitoring/webhook-log",
  tags: ["Monitoring"],
  summary: "List accepted incoming Channex webhook calls (admin only)",
  description: "One row per accepted POST /webhooks/channex call (after the shared-secret check passes).",
  security: AUTH,
  request: { query: listLimitQuerySchema },
  responses: {
    200: { description: "Webhook call log", content: { "application/json": { schema: z.object({ webhookLogs: z.array(webhookLogResponseSchema) }) } } },
    403: errorResponse("Caller's token does not carry the Super_Admin role"),
  },
});

registry.registerPath({
  method: "get",
  path: "/monitoring/error-queue",
  tags: ["Monitoring"],
  summary: "List queued processing failures (admin only)",
  description: "Currently written only from the webhook's fire-and-forget async processing catch block - the one place an error would otherwise only exist in stdout logs.",
  security: AUTH,
  request: { query: listLimitQuerySchema },
  responses: {
    200: { description: "Queued errors", content: { "application/json": { schema: z.object({ errors: z.array(errorQueueResponseSchema) }) } } },
    403: errorResponse("Caller's token does not carry the Super_Admin role"),
  },
});

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Gateway Quest (GQ) API",
      version: "0.1.0",
      description:
        "Channex.io channel-manager integration middleware for BQ/HMS - property/room-type/rate-plan onboarding and ARI (availability, rates, restrictions).",
    },
    servers: [{ url: "/api/gq" }],
  });
}
