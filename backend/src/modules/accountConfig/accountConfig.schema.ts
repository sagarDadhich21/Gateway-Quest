import { z } from "zod";

export const createAccountConfigSchema = z.object({
  bqPropertyId: z.coerce.number().int().positive().optional(),
  webhookUrl: z.string().url("webhookUrl must be a valid URL."),
  apiKey: z.string().min(1, "apiKey is required."),
  environment: z.string().min(1, "environment is required."),
  sendData: z.boolean().optional(),
});

export type CreateAccountConfigInput = z.infer<typeof createAccountConfigSchema>;

export const accountConfigIdParamSchema = z.object({
  accountConfigId: z.string().uuid("accountConfigId must be a valid id."),
});

export const setAccountConfigActiveSchema = z.object({
  isActive: z.boolean(),
});

export type SetAccountConfigActiveInput = z.infer<typeof setAccountConfigActiveSchema>;
