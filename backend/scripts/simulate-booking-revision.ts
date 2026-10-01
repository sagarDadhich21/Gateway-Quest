// Local test harness for Phase 6 (Booking Ingestion) - drives GQ's real
// processRevision() with a synthetic, hand-built Channex booking-revision payload,
// instead of a real one from Channex. Use this when Channex-side testing tools
// (Booking CRS API, Open Channel push-booking) aren't available/enabled yet - it still
// exercises everything GQ itself owns for real: property/room-type/rate-plan mapping
// resolution, idempotency, the real BQ booking-creation/modify/cancel API calls, and
// gq_ota_booking/gq_ota_booking_revision persistence.
//
// What this does NOT test: the actual Channex webhook delivery or revision-feed fetch
// (there's no real Channex-side revision behind a synthetic id), and the final
// POST /booking_revisions/:id/ack call to Channex will genuinely fail (404) since the
// synthetic revision id doesn't exist on Channex's side - processRevision() will
// therefore report `outcome: "blocked"` even when the BQ booking was created
// successfully. This script checks the real ground truth (gq_ota_booking's
// bq_orderid/bq_bookingid) separately below the raw result for that reason - trust that
// over the outcome label for a synthetic run.
//
// Run from gq/backend:
//   npx ts-node scripts/simulate-booking-revision.ts new
//   npx ts-node scripts/simulate-booking-revision.ts modified <bookingId from the "new" run's output>
//   npx ts-node scripts/simulate-booking-revision.ts cancelled <bookingId>
//
// Defaults below are real, already-onboarded values for property 1 (Pagoda Xecutive) -
// override via env vars if testing a different property:
//   CX_PROPERTY_ID, CX_ROOM_TYPE_ID, CX_RATE_PLAN_ID

import "dotenv/config";
import { randomUUID } from "crypto";
import { ChannexBookingRevisionAttributes } from "../src/clients/channex/channex.types";
import { findOtaBookingByCxId } from "../src/repositories/gqOtaBooking.repository";
import { processRevision } from "../src/modules/booking/booking.service";
import { disconnectPrisma } from "../src/repositories/prismaClient";
import { logger } from "../src/services/logger";

const CX_PROPERTY_ID = process.env.CX_PROPERTY_ID ?? "baa66c32-daf5-495c-a3ac-b27a2890c75a"; // property 1
const CX_ROOM_TYPE_ID = process.env.CX_ROOM_TYPE_ID ?? "4698b610-6391-4539-b81b-fc771a867e46"; // "Comfort"
const CX_RATE_PLAN_ID = process.env.CX_RATE_PLAN_ID ?? "5cd37e3d-3748-416d-a936-b1d15eecb218"; // "Breakfast"

type RevisionStatus = "new" | "modified" | "cancelled";

function parseStatus(value: string | undefined): RevisionStatus {
  if (value !== "new" && value !== "modified" && value !== "cancelled") {
    console.error("Usage: npx ts-node scripts/simulate-booking-revision.ts <new|modified|cancelled> [bookingId]");
    process.exit(1);
  }
  return value;
}

const status = parseStatus(process.argv[2]);
const existingBookingId = process.argv[3];

if (status !== "new" && !existingBookingId) {
  console.error(`A modified/cancelled run needs the bookingId from a prior "new" run's output as the second argument.`);
  process.exit(1);
}

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

async function run(): Promise<void> {
  const correlationId = randomUUID();
  const bookingId = existingBookingId ?? `sim-booking-${randomUUID()}`;
  const revisionId = `sim-revision-${randomUUID()}`;

  const revision: ChannexBookingRevisionAttributes = {
    id: revisionId,
    property_id: CX_PROPERTY_ID,
    booking_id: bookingId,
    ota_reservation_code: `SIM-${Date.now()}`,
    status,
    rooms: [
      {
        room_type_id: CX_ROOM_TYPE_ID,
        rate_plan_id: CX_RATE_PLAN_ID,
        checkin_date: isoDate(1),
        checkout_date: isoDate(3),
        amount: "4999",
        occupancy: { adults: 2 },
      },
    ],
    // name/surname separate, matching the real live API shape (see channex.types.ts).
    customer: { name: "Test", surname: "Guest", mail: "test.guest+gq-sim@example.com" },
    amount: "4999",
    currency: "INR",
    arrival_date: isoDate(1),
    departure_date: isoDate(3),
    inserted_at: new Date().toISOString(),
  };

  console.log(`Simulating a "${status}" revision for booking_id=${bookingId} ...`);
  const result = await processRevision(revision, correlationId);
  console.log("processRevision() result:", result);

  const row = await findOtaBookingByCxId(bookingId);
  console.log("gq_ota_booking ground truth:", row ? { id: row.id, status: row.status, bq_orderid: row.bq_orderid, bq_bookingid: row.bq_bookingid } : null);

  if (status === "new" && row?.bq_bookingid) {
    console.log(`\nReal BQ booking created: bq_bookingid=${row.bq_bookingid}, bq_orderid=${row.bq_orderid}`);
    console.log(`To simulate a modification or cancellation against it:`);
    console.log(`  npx ts-node scripts/simulate-booking-revision.ts modified ${bookingId}`);
    console.log(`  npx ts-node scripts/simulate-booking-revision.ts cancelled ${bookingId}`);
  }

  await disconnectPrisma();
}

run().catch((err) => {
  logger.error("simulate_booking_revision_crashed", { message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
