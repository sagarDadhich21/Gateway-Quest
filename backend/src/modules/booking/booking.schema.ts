import { z } from "zod";

/**
 * Deliberately loose - Channex's real webhook body varies by event type (see
 * channex.types.ts's ChannexWebhookPayload doc comment) and this route must accept
 * whatever Channex actually sends without rejecting unknown fields. Only `event` is
 * required; everything else is read defensively in booking.service.ts.
 */
export const channexWebhookSchema = z
  .object({
    event: z.string(),
    property_id: z.string().optional(),
    payload: z
      .object({
        booking_id: z.string().optional(),
        property_id: z.string().optional(),
        revision_id: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type ChannexWebhookBody = z.infer<typeof channexWebhookSchema>;

export const bookingIdParamSchema = z.object({
  propertyId: z.coerce.number().int().positive(),
  bookingId: z.string().uuid("bookingId must be a valid booking id."),
});

export const bookingRevisionIdParamSchema = z.object({
  propertyId: z.coerce.number().int().positive(),
  revisionId: z.string().uuid("revisionId must be a valid revision id."),
});

export const listBookingsQuerySchema = z.object({
  status: z.enum(["new", "modified", "cancelled"]).optional(),
});

export const listBookingRevisionsQuerySchema = z.object({
  ackStatus: z.enum(["pending", "acked"]).optional(),
});
