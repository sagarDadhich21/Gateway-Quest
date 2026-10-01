// Booking Revision Feed recovery poller (Phase 6) - the fallback for any webhook GQ
// missed. Meant to be triggered by an external scheduler (cron / Windows Task
// Scheduler) roughly every 15 minutes - deliberately NOT an in-process setInterval and
// NOT a queue, per this phase's explicit exclusion of new queue/deployment
// infrastructure. Runs every revision it finds through the exact same
// processRevision() the webhook route uses, so idempotency and mapping/error handling
// behave identically either way.
//
// CONSEQUENTIAL: this can create/cancel/modify real bookings in BQ. Run deliberately,
// not casually.
//
// Run from gq/backend:
//   npx ts-node scripts/run-revision-feed.ts
//
// Example crontab entry (every 15 minutes):
//   */15 * * * * cd /path/to/gq/backend && npx ts-node scripts/run-revision-feed.ts >> logs/revision-feed.log 2>&1
//
// Windows Task Scheduler: trigger "Repeat task every: 15 minutes", action:
//   Program: npx.cmd   Arguments: ts-node scripts/run-revision-feed.ts
//   Start in: <path to gq/backend>

import "dotenv/config";
import { randomUUID } from "crypto";
import { listBqProperties } from "../src/clients/bq/bq.client";
import { getChannexRevisionFeed } from "../src/clients/channex/channex.client";
import { processRevision } from "../src/modules/booking/booking.service";
import { disconnectPrisma } from "../src/repositories/prismaClient";
import { logger } from "../src/services/logger";

const PAGE_LIMIT = 50;

async function run(): Promise<void> {
  const correlationId = randomUUID();
  logger.info("revision_feed_run_started", { correlationId });

  const properties = await listBqProperties(correlationId);
  const onboarded = properties.filter((p) => p.cx_property_id);

  let totalAcked = 0;
  let totalSkipped = 0;
  let totalBlockedOrFailed = 0;

  for (const property of onboarded) {
    let page = 1;
    for (;;) {
      const feed = await getChannexRevisionFeed(property.cx_property_id!, page, PAGE_LIMIT, correlationId);

      for (const revision of feed.data) {
        const result = await processRevision(revision.attributes, correlationId);
        if (result.outcome === "acked") totalAcked++;
        else if (result.outcome === "skipped_already_acked") totalSkipped++;
        else totalBlockedOrFailed++;
      }

      const totalPages = Math.max(1, Math.ceil(feed.meta.total / feed.meta.limit));
      if (page >= totalPages) break;
      page++;
    }
  }

  logger.info("revision_feed_run_finished", {
    correlationId,
    propertiesChecked: onboarded.length,
    totalAcked,
    totalSkipped,
    totalBlockedOrFailed,
  });

  await disconnectPrisma();
}

run().catch((err) => {
  logger.error("revision_feed_run_crashed", { message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
