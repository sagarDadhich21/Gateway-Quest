import { Router } from "express";
import { getChannexBooking } from "../../clients/channex/channex.client";
import { webhookUnauthorizedError } from "../../errors/AppError";
import { asyncHandler } from "../../middleware/asyncHandler";
import { findActiveWebhookSecrets } from "../../repositories/gqAccountConfig.repository";
import { createErrorQueueEntry } from "../../repositories/gqErrorQueue.repository";
import { createWebhookLog } from "../../repositories/gqWebhookLog.repository";
import { logger } from "../../services/logger";
import { channexWebhookSchema, ChannexWebhookBody } from "./booking.schema";
import { processRevision } from "./booking.service";

export const bookingRouter = Router();

/**
 * Custom header name GQ expects Channex to send back on every webhook call - set via
 * the `headers` field when the webhook is registered with Channex (POST /webhooks).
 * This is the actual, complete verification mechanism available: Channex documents no
 * cryptographic signature scheme for webhooks at all (confirmed from their own docs,
 * not assumed) - only this kind of shared-secret comparison. Exported so
 * accountConfig.service.ts's registerAccountConfigWithChannex() sets the exact same
 * header name when registering with Channex, rather than a second hardcoded copy that
 * could drift out of sync.
 */
export const WEBHOOK_SECRET_HEADER = "x-channex-webhook-secret";

/**
 * POST /webhooks/channex - public, no user JWT (see middleware wiring in routes/
 * index.ts, this router is never given `authenticate`). Verifies the shared-secret
 * header, responds 200 immediately, then processes the revision without blocking the
 * response - a detached async continuation within this same process, not a queue
 * (explicitly excluded from this phase), satisfying "process asynchronously" and
 * "return 200 quickly" without new infrastructure.
 */
bookingRouter.post(
  "/channex",
  asyncHandler(async (req, res) => {
    const secretHeader = req.header(WEBHOOK_SECRET_HEADER);
    const activeSecrets = await findActiveWebhookSecrets();

    if (activeSecrets.length === 0 || !secretHeader || !activeSecrets.includes(secretHeader)) {
      throw webhookUnauthorizedError();
    }

    const body = channexWebhookSchema.parse(req.body);
    const correlationId = req.correlationId;

    logger.info("channex_webhook_received", { correlationId, event: body.event });

    res.status(200).json({ received: true });

    const ref = body.payload?.booking_id ?? body.payload?.revision_id ?? body.event;
    void createWebhookLog({ event: body.event, ref, httpStatusReturned: 200 }).catch((err) => {
      logger.error("webhook_log_write_failed", { correlationId, message: err instanceof Error ? err.message : String(err) });
    });

    void handleWebhookAsync(body, correlationId);
  })
);

async function handleWebhookAsync(body: ChannexWebhookBody, correlationId: string): Promise<void> {
  try {
    const bookingId = body.payload?.booking_id;
    if (!bookingId) {
      // Non-booking events (ari, message, sync_error, channel lifecycle, etc.) have no
      // revision to process - acknowledged at the HTTP level only, nothing further to do.
      logger.info("channex_webhook_non_booking_event", { correlationId, event: body.event });
      return;
    }

    const detail = await getChannexBooking(bookingId, correlationId);
    await processRevision(detail.data.attributes, correlationId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("channex_webhook_async_processing_failed", { correlationId, message });

    // The one place in the app where an error is logged and then silently dropped with
    // nothing else to inspect it by later - persist it so it's visible on the Error
    // Queue monitoring page instead of only in stdout.
    await createErrorQueueEntry({
      source: "channex_webhook_async_processing",
      payload: { correlationId, event: body.event, bookingId: body.payload?.booking_id ?? null },
      errorMessage: message,
    }).catch((queueErr) => {
      logger.error("error_queue_write_failed", {
        correlationId,
        message: queueErr instanceof Error ? queueErr.message : String(queueErr),
      });
    });
  }
}
