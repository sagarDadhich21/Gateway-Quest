import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { unauthenticatedError } from "../errors/AppError";
import { GqTokenPayload } from "../modules/auth/auth.types";

/**
 * Verifies GQ's own token (issued at login by auth.service.ts) - never BQ/EQ's token.
 * GQ does not proxy or trust upstream tokens; once login succeeds it only relies on
 * its own session from then on.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;

  if (!token) {
    next(unauthenticatedError("Missing or malformed Authorization header."));
    return;
  }

  try {
    const payload = jwt.verify(token, env.GQ_JWT_SECRET) as unknown as GqTokenPayload;
    req.user = {
      id: payload.sub,
      bqUserId: payload.bqUserId,
      propertyId: payload.propertyId,
      roles: payload.roles ?? [],
    };
    next();
  } catch {
    next(unauthenticatedError("Invalid or expired session. Please log in again."));
  }
}
