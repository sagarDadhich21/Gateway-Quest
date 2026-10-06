import { Router } from "express";
import { getChannexBooking, getChannexRevisionFeed } from "../../clients/channex/channex.client";
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

/**
 * Channex's own webhook docs (docs.channex.io/api-v.1-documentation/webhook-collection)
 * say booking_new/booking_modification/booking_cancellation/non_acked_booking all carry
 * `payload.booking_id` - but confirmed live on 2026-10-06, a real booking_new/booking
 * pair arrived with no usable id in `payload` at all (payload.booking_id and
 * payload.revision_id both absent), so GQ fell into the non-booking-event branch below
 * and silently discarded a real booking. Any event name in this list is booking-related
 * and must never be discarded just because its payload didn't carry an id - see the
 * fallback in handleWebhookAsync.
 */
const BOOKING_CATEGORY_EVENT_PREFIX = "booking";
const NON_ACKED_BOOKING_EVENT = "non_acked_booking";

function isBookingCategoryEvent(event: string): boolean {
  return event === NON_ACKED_BOOKING_EVENT || event.startsWith(BOOKING_CATEGORY_EVENT_PREFIX);
}

// Page size for the fallback feed pull below - this is a live-triggered catch-up for
// the one event that just fired, not the recovery poller's historical catch-up, so a
// small page is enough to find the triggering revision among the most recent ones.
const FALLBACK_FEED_PAGE_LIMIT = 20;

async function handleWebhookAsync(body: ChannexWebhookBody, correlationId: string): Promise<void> {
  try {
    const bookingId = body.payload?.booking_id;
    if (bookingId) {
      const detail = await getChannexBooking(bookingId, correlationId);
      await processRevision(detail.data.attributes, correlationId);
      return;
    }

    if (!isBookingCategoryEvent(body.event)) {
      // Non-booking events (ari, message, sync_error, channel lifecycle, etc.) have no
      // revision to process - acknowledged at the HTTP level only, nothing further to do.
      logger.info("channex_webhook_non_booking_event", { correlationId, event: body.event });
      return;
    }

    // A booking-category event arrived with no payload.booking_id to pull the single
    // booking by - fall back to the property's revision feed instead of discarding it.
    // This is the exact same read+processRevision() the recovery poller
    // (scripts/run-revision-feed.ts) uses, so idempotency/mapping/error handling behave
    // identically; it's just triggered immediately by this webhook instead of waiting
    // for the poller's ~15-minute schedule.
    const cxPropertyId = body.property_id;
    if (!cxPropertyId) {
      throw new Error(
        `Booking-category webhook event "${body.event}" has no payload.booking_id and no root property_id to recover via the revision feed.`
      );
    }

    logger.warn("channex_webhook_booking_event_missing_id_falling_back_to_feed", {
      correlationId,
      event: body.event,
      cxPropertyId,
    });

    const feed = await getChannexRevisionFeed(cxPropertyId, 1, FALLBACK_FEED_PAGE_LIMIT, correlationId);
    for (const revision of feed.data) {
      await processRevision(revision.attributes, correlationId);
    }
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
