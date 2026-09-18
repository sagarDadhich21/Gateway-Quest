import { getBqProperty, patchBqChannexMapping } from "../../clients/bq/bq.client";
import { createChannexProperty } from "../../clients/channex/channex.client";
import { logger } from "../../services/logger";
import { assertUserOwnsProperty } from "../property/property.service";
import { AuthenticatedGqUser } from "../../types/express";
import { mapBqPropertyToChannexPayload } from "./channex.mapper";
 
export interface OnboardPropertyResult {
  propertyId: number;
  channexPropertyId: string;
  status: "onboarded" | "already_onboarded";
}
 
/**
 * Onboards a BQ property onto Channex: GQ Frontend -> GQ Backend -> BQ API -> Channex API.
 *
 * Idempotent by design (required by spec): `BQ.property.cx_property_id` is the only
 * place this integration considers a property "onboarded" - there is no separate GQ
 * cache of that fact to fall out of sync, so the check is simply "does BQ already have
 * one?" before ever calling Channex.
 */
export async function onboardProperty(
  user: AuthenticatedGqUser,
  propertyId: number,
  correlationId: string
): Promise<OnboardPropertyResult> {
  assertUserOwnsProperty(user, propertyId);
 
  const bqProperty = await getBqProperty(propertyId, correlationId);
 
  if (bqProperty.cx_property_id) {
    return {
      propertyId,
      channexPropertyId: bqProperty.cx_property_id,
      status: "already_onboarded",
    };
  }
 
  const payload = mapBqPropertyToChannexPayload(bqProperty);
 
  const channexResponse = await createChannexProperty(payload, correlationId);
  const createdProperty = Array.isArray(channexResponse.data)
    ? channexResponse.data[0]
    : channexResponse.data;
  const cxPropertyId = createdProperty.id;
 
  await patchBqChannexMapping(propertyId, cxPropertyId, correlationId);
 
  logger.info("channex_property_onboarded", { correlationId, propertyId, cxPropertyId });
 
  return {
    propertyId,
    channexPropertyId: cxPropertyId,
    status: "onboarded",
  };
}
 
 