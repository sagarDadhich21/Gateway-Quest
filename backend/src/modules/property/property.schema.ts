import { z } from "zod";

export const propertyIdParamSchema = z.object({
  propertyId: z.coerce.number().int().positive("propertyId must be a positive integer."),
});

export type PropertyIdParam = z.infer<typeof propertyIdParamSchema>;
