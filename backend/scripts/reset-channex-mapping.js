// Fully resets a property's Channex integration state, both on the BQ side and the
// GQ side, as if it had never been onboarded:
//   1. Deletes every gq_rate_restriction row for the property (GQ-owned)
//   2. Deletes every gq_rate_plan_option row for the property's rate plans (GQ-owned)
//   3. Deletes every gq_rate_plan row for the property (GQ-owned)
//   4. Deletes every gq_availability_snapshot row for the property (GQ-owned last-pushed
//      availability cache)
//   5. Deletes every gq_ota_tax / gq_ota_booking_guest row under the property's OTA
//      booking rooms, then the rooms, then every gq_ota_booking_revision, then every
//      gq_ota_booking itself (GQ-owned Phase 6 ingestion state) - none of these FKs
//      cascade (all `onDelete: NoAction`), so children must go before parents
//   6. Deletes every gq_channel_mapping row under the property's channels, then every
//      gq_channel row for the property itself (GQ-owned channel connections - not just
//      onboarding, since a stale channel/mapping is exactly what causes "why is this
//      still unresolved" confusion after a reset)
//   7. Clears roomtype.cx_room_type_id -> NULL for every room type on the property (BQ)
//   8. Clears property.cx_property_id -> NULL for the property itself (BQ)
//   9. Deletes every row from the 4 Monitoring tables - gq_push_task, gq_api_log,
//      gq_webhook_log, gq_error_queue - ENTIRELY, account-wide, not just for this
//      property. None of these 4 carry a bq_property_id at all (confirmed in
//      backend/README.md's Monitoring section), so there is no way to scope this to one
//      property; running this script against any property clears all of them for every
//      property.
//   10. Deletes every gq_account_config row too - ALSO entirely, account-wide (it only
//       optionally carries a bq_property_id, so "just this property's rows" would still
//       leave the global one and any other property's rows behind). This deletes the
//       live webhook secret(s) - every inbound Channex webhook call will be rejected
//       with 401 WEBHOOK_UNAUTHORIZED until a new config is created and registered with
//       Channex again (see backend/webhooks.md).
//
// Also prints the property's current BQ currency/country/timezone before doing
// anything, purely as a sanity check to catch a wrong value before re-onboarding with
// it - this script never modifies those fields itself.
//
// Run from gq/backend (needs a real .env there with DATABASE_URL):
//   node scripts/reset-channex-mapping.js <propertyId>
//
// Example (property 1):
//   node scripts/reset-channex-mapping.js 1

require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");

const propertyId = Number(process.argv[2]);
if (!Number.isInteger(propertyId) || propertyId <= 0) {
  console.error("Usage: node scripts/reset-channex-mapping.js <propertyId>");
  process.exit(1);
}

const prisma = new PrismaClient();

(async () => {
  console.log(`Resetting Channex mapping for property ${propertyId}...`);

  const propertyRows = await prisma.$queryRawUnsafe(
    `SELECT name, currency, country, time_zone, cx_property_id FROM property WHERE propertyid = $1`,
    propertyId
  );
  if (propertyRows.length === 0) {
    console.error(`No property with propertyid=${propertyId} found.`);
    process.exit(1);
  }
  const { name, currency, country, time_zone, cx_property_id } = propertyRows[0];
  console.log(
    `Property ${propertyId} (${name}) - currency: ${currency ?? "(not set)"}, country: ${country ?? "(not set)"}, ` +
      `time_zone: ${time_zone ?? "(not set)"}, currently onboarded to Channex: ${cx_property_id ? "yes (" + cx_property_id + ")" : "no"}`
  );
  if (!currency || !country) {
    console.warn(
      "WARNING: currency and/or country is not set on this property - Channex onboarding requires both. " +
        "Set them on the property in BQ before re-onboarding, or the next onboarding call will fail/use wrong values."
    );
  }

  const ratePlans = await prisma.gq_rate_plan.findMany({
    where: { bq_property_id: propertyId },
    select: { id: true, name: true },
  });
  const ratePlanIds = ratePlans.map((rp) => rp.id);
  console.log(`Found ${ratePlanIds.length} gq_rate_plan row(s):`, ratePlans.map((rp) => rp.name));

  const restrictionsDeleted = await prisma.gq_rate_restriction.deleteMany({
    where: { bq_property_id: propertyId },
  });
  console.log("gq_rate_restriction deleted:", restrictionsDeleted.count);

  const optionsDeleted = await prisma.gq_rate_plan_option.deleteMany({
    where: { rate_plan_id: { in: ratePlanIds } },
  });
  console.log("gq_rate_plan_option deleted:", optionsDeleted.count);

  const plansDeleted = await prisma.gq_rate_plan.deleteMany({
    where: { bq_property_id: propertyId },
  });
  console.log("gq_rate_plan deleted:", plansDeleted.count);

  const availabilityDeleted = await prisma.gq_availability_snapshot.deleteMany({
    where: { bq_property_id: propertyId },
  });
  console.log("gq_availability_snapshot deleted:", availabilityDeleted.count);

  // Booking ingestion state (Phase 6) - walk the chain top-down to find ids, then
  // delete bottom-up since none of these FKs cascade.
  const otaBookings = await prisma.gq_ota_booking.findMany({
    where: { bq_property_id: propertyId },
    select: { id: true },
  });
  const otaBookingIds = otaBookings.map((b) => b.id);

  const revisions = await prisma.gq_ota_booking_revision.findMany({
    where: { ota_booking_id: { in: otaBookingIds } },
    select: { id: true },
  });
  const revisionIds = revisions.map((r) => r.id);

  const rooms = await prisma.gq_ota_booking_room.findMany({
    where: { revision_id: { in: revisionIds } },
    select: { id: true },
  });
  const roomIds = rooms.map((r) => r.id);

  const taxesDeleted = await prisma.gq_ota_tax.deleteMany({ where: { room_id: { in: roomIds } } });
  console.log("gq_ota_tax deleted:", taxesDeleted.count);

  const guestsDeleted = await prisma.gq_ota_booking_guest.deleteMany({ where: { room_id: { in: roomIds } } });
  console.log("gq_ota_booking_guest deleted:", guestsDeleted.count);

  const roomsDeleted = await prisma.gq_ota_booking_room.deleteMany({ where: { id: { in: roomIds } } });
  console.log("gq_ota_booking_room deleted:", roomsDeleted.count);

  const revisionsDeleted = await prisma.gq_ota_booking_revision.deleteMany({ where: { id: { in: revisionIds } } });
  console.log("gq_ota_booking_revision deleted:", revisionsDeleted.count);

  const bookingsDeleted = await prisma.gq_ota_booking.deleteMany({ where: { id: { in: otaBookingIds } } });
  console.log("gq_ota_booking deleted:", bookingsDeleted.count);

  // Channel connections + their room/rate mappings - GQ's local cache only. Channex has
  // no API to delete a channel or its mappings, so the real connection still exists on
  // Channex's side until removed there too; this only clears what GQ itself remembers,
  // same as everywhere else in this codebase that touches channel/mapping data. Deleted
  // last among the GQ-owned tables since a stale local channel/mapping row from a
  // previous onboarding is exactly the kind of thing that causes confusing "still
  // unresolved" behavior after a reset.
  const channels = await prisma.gq_channel.findMany({
    where: { bq_property_id: propertyId },
    select: { id: true, title: true },
  });
  const channelIds = channels.map((c) => c.id);
  console.log(`Found ${channelIds.length} gq_channel row(s):`, channels.map((c) => c.title));

  const channelMappingsDeleted = await prisma.gq_channel_mapping.deleteMany({
    where: { channel_id: { in: channelIds } },
  });
  console.log("gq_channel_mapping deleted:", channelMappingsDeleted.count);

  const channelsDeleted = await prisma.gq_channel.deleteMany({ where: { id: { in: channelIds } } });
  console.log("gq_channel deleted:", channelsDeleted.count);

  const roomTypesUpdated = await prisma.$executeRawUnsafe(
    `UPDATE roomtype SET cx_room_type_id = NULL WHERE propertyid = $1`,
    propertyId
  );
  console.log("roomtype.cx_room_type_id cleared for", roomTypesUpdated, "row(s)");

  const propertyUpdated = await prisma.$executeRawUnsafe(
    `UPDATE property SET cx_property_id = NULL WHERE propertyid = $1`,
    propertyId
  );
  console.log("property.cx_property_id cleared for", propertyUpdated, "row(s)");

  // Monitoring tables - account-wide, not property-scoped (no bq_property_id column on
  // any of the 4), so this clears them for every property, not just propertyId above.
  console.log("Clearing Monitoring tables (account-wide - not scoped to this property)...");

  const pushTasksDeleted = await prisma.gq_push_task.deleteMany({});
  console.log("gq_push_task deleted:", pushTasksDeleted.count);

  const apiLogsDeleted = await prisma.gq_api_log.deleteMany({});
  console.log("gq_api_log deleted:", apiLogsDeleted.count);

  const webhookLogDeleted = await prisma.gq_webhook_log.deleteMany({});
  console.log("gq_webhook_log deleted:", webhookLogDeleted.count);

  const errorQueueDeleted = await prisma.gq_error_queue.deleteMany({});
  console.log("gq_error_queue deleted:", errorQueueDeleted.count);

  // Also account-wide - webhook secrets/registrations, not scoped to this property
  // either. Deleting these breaks live webhook delivery until a new config is created
  // and registered with Channex again.
  const accountConfigsDeleted = await prisma.gq_account_config.deleteMany({});
  console.log("gq_account_config deleted:", accountConfigsDeleted.count);

  await prisma.$disconnect();
  console.log("Done.");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
