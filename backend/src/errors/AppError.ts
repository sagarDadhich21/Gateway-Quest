/**
 * Typed application errors. Every error the API can return in a controlled way should
 * be one of these, so the central error handler can map it to the right HTTP status
 * and a safe, user-facing message without ever leaking upstream internals (BQ stack
 * traces, Channex API keys, raw axios errors) to the client.
 */

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "MFA_REQUIRED"
  | "PROPERTY_REGISTRATION_REQUIRED"
  | "EMAIL_VERIFICATION_REQUIRED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN_PROPERTY_ACCESS"
  | "PROPERTY_NOT_FOUND"
  | "PROPERTY_MISSING_CHANNEX_FIELDS"
  | "ROOM_TYPE_NOT_FOUND"
  | "RATE_PLAN_NOT_FOUND"
  | "CHANNEL_NOT_FOUND"
  | "CHANNEL_NOT_ONBOARDED"
  | "UNMAPPED_ROOM_TYPES"
  | "UNMAPPED_RATE_PLAN"
  | "OVERSELL_GUARD"
  | "BOOKING_NOT_FOUND"
  | "BOOKING_REVISION_NOT_FOUND"
  | "UNMAPPED_BOOKING_PROPERTY"
  | "UNMAPPED_BOOKING_ROOM_OR_RATE"
  | "WEBHOOK_UNAUTHORIZED"
  | "ADMIN_ONLY"
  | "ACCOUNT_CONFIG_NOT_FOUND"
  | "BQ_UPSTREAM_ERROR"
  | "BQ_UPSTREAM_UNAVAILABLE"
  | "PRICING_SERVICE_UPSTREAM_ERROR"
  | "PRICING_SERVICE_UPSTREAM_UNAVAILABLE"
  | "CHANNEX_UPSTREAM_ERROR"
  | "CHANNEX_UPSTREAM_UNAVAILABLE"
  | "CHANNEX_WARNINGS"
  | "CHANNEX_UNEXPECTED_RESPONSE"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly httpStatus: number;
  /** Extra structured detail that is safe to return to the client (e.g. a list of missing fields). */
  readonly details?: unknown;

  constructor(code: AppErrorCode, httpStatus: number, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export function validationError(message: string, details?: unknown): AppError {
  return new AppError("VALIDATION_ERROR", 422, message, details);
}

export function unauthenticatedError(message = "Authentication required."): AppError {
  return new AppError("UNAUTHENTICATED", 401, message);
}

export function forbiddenPropertyAccessError(): AppError {
  return new AppError(
    "FORBIDDEN_PROPERTY_ACCESS",
    403,
    "You do not have access to this property."
  );
}

export function propertyNotFoundError(): AppError {
  return new AppError("PROPERTY_NOT_FOUND", 404, "Property not found.");
}

export function roomTypeNotFoundError(): AppError {
  return new AppError("ROOM_TYPE_NOT_FOUND", 404, "Room type not found.");
}

export function ratePlanNotFoundError(): AppError {
  return new AppError("RATE_PLAN_NOT_FOUND", 404, "Rate plan not found.");
}

export function channelNotFoundError(): AppError {
  return new AppError("CHANNEL_NOT_FOUND", 404, "Channel not found.");
}

export function propertyNotOnboardedError(): AppError {
  return new AppError(
    "CHANNEL_NOT_ONBOARDED",
    422,
    "This property must be onboarded to Channex before channels can be set up."
  );
}

export function unmappedRoomTypesError(roomTypeNames: string[]): AppError {
  return new AppError(
    "UNMAPPED_ROOM_TYPES",
    422,
    "Cannot push availability for room type(s) with no Channex room_type_id mapping.",
    { unmappedRoomTypes: roomTypeNames }
  );
}

export function unmappedRatePlanError(): AppError {
  return new AppError(
    "UNMAPPED_RATE_PLAN",
    422,
    "This rate plan is not onboarded to Channex - map it before pushing restrictions."
  );
}

export function oversellGuardError(details: unknown): AppError {
  return new AppError(
    "OVERSELL_GUARD",
    422,
    "Availability requested exceeds the room type's physical room count.",
    details
  );
}

export function bookingNotFoundError(): AppError {
  return new AppError("BOOKING_NOT_FOUND", 404, "Booking not found.");
}

export function bookingRevisionNotFoundError(): AppError {
  return new AppError("BOOKING_REVISION_NOT_FOUND", 404, "Booking revision not found.");
}

export function unmappedBookingPropertyError(cxPropertyId: string): AppError {
  return new AppError(
    "UNMAPPED_BOOKING_PROPERTY",
    422,
    "This booking's Channex property is not mapped to any onboarded BQ property.",
    { cxPropertyId }
  );
}

export function unmappedBookingRoomOrRateError(details: unknown): AppError {
  return new AppError(
    "UNMAPPED_BOOKING_ROOM_OR_RATE",
    422,
    "This booking's room type or rate plan is not mapped to an onboarded BQ room type / GQ rate plan.",
    details
  );
}

export function webhookUnauthorizedError(): AppError {
  return new AppError("WEBHOOK_UNAUTHORIZED", 401, "Invalid or missing webhook secret.");
}

export function adminOnlyError(): AppError {
  return new AppError("ADMIN_ONLY", 403, "This action requires the Super_Admin role.");
}

export function accountConfigNotFoundError(): AppError {
  return new AppError("ACCOUNT_CONFIG_NOT_FOUND", 404, "Account config not found.");
}
