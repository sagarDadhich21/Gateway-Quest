import { z } from "zod";

export const createAccountConfigSchema = z.object({
  bqPropertyId: z.coerce.number().int().positive().optional(),
  webhookUrl: z.string().url("webhookUrl must be a valid URL."),
  apiKey: z.string().min(1, "apiKey is required."),
  environment: z.string().min(1, "environment is required."),
  sendData: z.boolean().optional(),
});

export type CreateAccountConfigInput = z.infer<typeof createAccountConfigSchema>;
