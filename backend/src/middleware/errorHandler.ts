import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";
import { logger } from "../services/logger";

/**
 * Central error handler. Every route in this service should let errors bubble up to
 * here (via next(err) or an async wrapper) rather than formatting error responses
 * inline - this is the one place that decides what is safe to send to a client.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const correlationId = req.correlationId;

  if (err instanceof AppError) {
    if (err.httpStatus >= 500) {
      logger.error("request_failed", {
        correlationId,
        code: err.code,
        message: err.message,
      });
    } else {
      logger.warn("request_rejected", {
        correlationId,
        code: err.code,
        message: err.message,
      });
    }
    res.status(err.httpStatus).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        correlationId,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    logger.warn("request_validation_failed", { correlationId, issues: err.issues });
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        correlationId,
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  logger.error("unhandled_error", { correlationId, message });
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      correlationId,
    },
  });
}
