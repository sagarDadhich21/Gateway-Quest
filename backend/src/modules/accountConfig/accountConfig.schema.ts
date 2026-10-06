import { z } from "zod";

// webhookUrl, apiKey and environment are deliberately not accepted from the client -
// webhookUrl is always env.PUBLIC_WEBHOOK_BASE_URL + the fixed webhook path (a free-text
// field was the actual cause of the duplicate/stale gq_account_config rows this table
// kept accumulating), apiKey was never read anywhere (every real Channex call already
// uses the single server-level CHANNEX_API_KEY), and environment is always
// env.CHANNEX_ENVIRONMENT (a per-row free-text copy of it could silently disagree with
// which Channex base URL the server is actually configured against).
export const createAccountConfigSchema = z.object({
  bqPropertyId: z.coerce.number().int().positive().optional(),
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
