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
  | "BQ_UPSTREAM_ERROR"
  | "BQ_UPSTREAM_UNAVAILABLE"
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
