import { z } from "zod";

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional().default(100),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
