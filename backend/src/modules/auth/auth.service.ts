import jwt from "jsonwebtoken";
import { loginAgainstBq } from "../../clients/bq/bq.client";
import { BqLoginResponse } from "../../clients/bq/bq.types";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { upsertGqUserByBqUserId } from "../../repositories/gqUser.repository";
import { GqTokenPayload } from "./auth.types";

export interface LoginResult {
  token: string;
  expiresInMinutes: number;
  user: {
    id: string;
    bqUserId: number;
    propertyId: number | null;
    roles: string[];
  };
}

function hasUser(
  response: BqLoginResponse
): response is Extract<BqLoginResponse, { user: unknown }> {
  return "user" in response && typeof response.user === "object" && response.user !== null;
}

/**
 * Authenticates a GQ login against BQ/EQ's existing login API and, on success, issues
 * GQ's own session token. GQ never creates or stores a password of its own - every
 * login re-validates the credential against BQ/EQ.
 *
 * EQ's login endpoint has other, non-error 200 outcomes (MFA pending, first-login
 * property registration pending, email verification pending) that this phase does not
 * attempt to complete on the caller's behalf - each is surfaced as its own clear error
 * so the frontend can send the user to finish that step in the existing HMS UI.
 */
export async function login(
  email: string,
  password: string,
  correlationId: string
): Promise<LoginResult> {
  const bqResponse = await loginAgainstBq(email, password, correlationId);

  if ("requires_otp_verification" in bqResponse && bqResponse.requires_otp_verification) {
    throw new AppError(
      "MFA_REQUIRED",
      401,
      "This account requires two-factor verification. Please complete login in the HMS first."
    );
  }

  if (
    "requires_property_registration" in bqResponse &&
    bqResponse.requires_property_registration
  ) {
    throw new AppError(
      "PROPERTY_REGISTRATION_REQUIRED",
      401,
      "This account has not registered a property yet. Please complete property registration in the HMS first."
    );
  }

  if (!hasUser(bqResponse)) {
    throw new AppError(
      "EMAIL_VERIFICATION_REQUIRED",
      401,
      "This account has not completed email verification. Please complete it in the HMS first."
    );
  }

  const bqUser = bqResponse.user;
  const gqUser = await upsertGqUserByBqUserId(bqUser.id);

  const payload: GqTokenPayload = {
    sub: gqUser.id,
    bqUserId: bqUser.id,
    propertyId: bqUser.property_id,
    roles: bqUser.roles,
  };

  const token = jwt.sign(payload, env.GQ_JWT_SECRET, {
    expiresIn: `${env.GQ_JWT_EXPIRES_IN_MINUTES}m`,
  });

  return {
    token,
    expiresInMinutes: env.GQ_JWT_EXPIRES_IN_MINUTES,
    user: {
      id: gqUser.id,
      bqUserId: bqUser.id,
      propertyId: bqUser.property_id,
      roles: bqUser.roles,
    },
  };
}
