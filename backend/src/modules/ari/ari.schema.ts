import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a YYYY-MM-DD date.");

/** Shared by both GET endpoints - a date range plus an optional room-type filter. */
export const ariDateRangeQuerySchema = z
  .object({
    dateFrom: isoDateSchema,
    dateTo: isoDateSchema,
    roomTypeId: z.coerce.number().int().positive().optional(),
  })
  .refine((q) => q.dateFrom <= q.dateTo, {
    message: "dateFrom must not be after dateTo.",
    path: ["dateFrom"],
  });

export type AriDateRangeQuery = z.infer<typeof ariDateRangeQuerySchema>;

const availabilityValueSchema = z.object({
  roomTypeId: z.number().int().positive(),
  date: isoDateSchema,
  availability: z.number().int().min(0, "availability cannot be negative."),
});

export const pushAvailabilitySchema = z.object({
  values: z.array(availabilityValueSchema).min(1, "At least one availability value is required."),
});

export type PushAvailabilityRequest = z.infer<typeof pushAvailabilitySchema>;

/**
 * `rate` is optional - when omitted the service looks it up from pricing-service (see
 * ari.service.ts pushRestrictions), per this phase's requirement to read pricing from
 * the existing pricing-service API. When provided, it is a major-unit amount (e.g.
 * 4500.50) - conversion to Channex's minor units happens in the service, never here.
 */
const restrictionValueSchema = z
  .object({
    date: isoDateSchema,
    rate: z.number().positive("rate must be greater than 0.").optional(),
    minStayArrival: z.number().int().positive().optional(),
    minStayThrough: z.number().int().positive().optional(),
    minStay: z.number().int().positive().optional(),
    maxStay: z.number().int().positive().optional(),
    closedToArrival: z.boolean().optional(),
    closedToDeparture: z.boolean().optional(),
    stopSell: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.rate !== undefined ||
      v.minStayArrival !== undefined ||
      v.minStayThrough !== undefined ||
      v.minStay !== undefined ||
      v.maxStay !== undefined ||
      v.closedToArrival !== undefined ||
      v.closedToDeparture !== undefined ||
      v.stopSell !== undefined,
    { message: "At least one restriction field must be set on each value." }
  );

export const pushRestrictionsSchema = z.object({
  ratePlanId: z.string().uuid("ratePlanId must be a valid rate plan id."),
  values: z.array(restrictionValueSchema).min(1, "At least one restriction value is required."),
});

export type PushRestrictionsRequest = z.infer<typeof pushRestrictionsSchema>;
