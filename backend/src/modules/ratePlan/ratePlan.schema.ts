import { z } from "zod";

/** Matches Channex's documented sell_mode/rate_mode enums (CHANNEX_BQ_API_DB_MAPPING.md section 3.5). */
const sellModeSchema = z.enum(["per_room", "per_person"]);
const rateModeSchema = z.enum(["manual", "derived", "auto", "cascade"]);

/**
 * `rate` is deliberately not accepted here - per this phase's explicit scope, every
 * option is always created at rate 0; real rates are pushed later via ARI (not
 * implemented here).
 */
const optionInputSchema = z.object({
  occupancy: z.number().int().positive("occupancy must be a positive integer."),
  isPrimary: z.boolean().optional().default(false),
});

export const createRatePlanSchema = z.object({
  propertyId: z.coerce.number().int().positive(),
  roomTypeId: z.coerce.number().int().positive(),
  name: z.string().min(1, "name is required."),
  // Optional - defaults to the property's own BQ currency when omitted (see ratePlan.service.ts).
  currency: z
    .string()
    .length(3, "currency must be a 3-letter ISO 4217 code.")
    .transform((v) => v.toUpperCase())
    .optional(),
  sellMode: sellModeSchema.default("per_room"),
  rateMode: rateModeSchema.default("manual"),
  mealType: z.string().min(1).optional(),
  parentRatePlanId: z.string().uuid("parentRatePlanId must be a valid rate plan id.").optional(),
  isDefault: z.boolean().optional().default(false),
  options: z.array(optionInputSchema).min(1, "At least one occupancy option is required."),
});

export type CreateRatePlanRequest = z.infer<typeof createRatePlanSchema>;

export const updateRatePlanSchema = z
  .object({
    name: z.string().min(1).optional(),
    currency: z
      .string()
      .length(3, "currency must be a 3-letter ISO 4217 code.")
      .transform((v) => v.toUpperCase())
      .optional(),
    sellMode: sellModeSchema.optional(),
    rateMode: rateModeSchema.optional(),
    mealType: z.string().min(1).optional(),
    isDefault: z.boolean().optional(),
    options: z.array(optionInputSchema).min(1).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided.",
  });

export type UpdateRatePlanRequest = z.infer<typeof updateRatePlanSchema>;

export const ratePlanIdParamSchema = z.object({
  ratePlanId: z.string().uuid("ratePlanId must be a valid rate plan id."),
});

export const listRatePlansQuerySchema = z.object({
  propertyId: z.coerce.number().int().positive().optional(),
  roomTypeId: z.coerce.number().int().positive().optional(),
});
