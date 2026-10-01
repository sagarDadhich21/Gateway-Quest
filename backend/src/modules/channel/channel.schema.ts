import { z } from "zod";

export const channelIdParamSchema = z.object({
  channelId: z.string().uuid("channelId must be a valid channel id."),
});

export const channelMappingIdParamSchema = z.object({
  channelId: z.string().uuid("channelId must be a valid channel id."),
  mappingId: z.string().uuid("mappingId must be a valid mapping id."),
});

/**
 * `username` identifies the PMS user to Channex for the one-time-token/IFrame flow
 * (docs.channex.io/api-v.1-documentation/channel-iframe) - GQ has no username field of
 * its own on the authenticated session (see types/express.ts AuthenticatedGqUser), so
 * the caller supplies it; falls back to a bqUserId-based identifier if omitted.
 */
export const generateConnectionTokenSchema = z.object({
  username: z.string().min(1).optional(),
});

export type GenerateConnectionTokenRequest = z.infer<typeof generateConnectionTokenSchema>;
