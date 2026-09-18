/**
 * Types mirroring gq backend's actual response shapes (see ../../backend/src/modules
 * and ../../backend/src/middleware/errorHandler.ts). Kept in sync by hand since
 * frontend and backend are separate TypeScript projects.
 */

export interface GqApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    correlationId: string;
  };
}

export interface PropertyResponse {
  id: number;
  name: string;
  city: string;
  location: string;
  address: string;
  phone: string | null;
  email: string | null;
  currency: string | null;
  country: string | null;
  state: string | null;
  zipCode: string | null;
  timeZone: string | null;
  channex: {
    onboarded: boolean;
    propertyId: string | null;
  };
}

export interface OnboardResponse {
  propertyId: number;
  channexPropertyId: string;
  status: "onboarded" | "already_onboarded";
}
