import { cancelBqBooking, createBqBooking, findBqBookingById, listBqProperties, modifyBqBooking } from "../../clients/bq/bq.client";
import { getBqRoomTypes } from "../../clients/bq/bq.client";
import { ackChannexRevision } from "../../clients/channex/channex.client";
import { ChannexBookingRevisionAttributes, ChannexBookingRevisionRoom } from "../../clients/channex/channex.types";
import { bookingNotFoundError, bookingRevisionNotFoundError } from "../../errors/AppError";
import { toMinorUnits } from "../../lib/currency";
import * as ratePlanRepo from "../../repositories/gqRatePlan.repository";
import * as otaBookingRepo from "../../repositories/gqOtaBooking.repository";
import * as revisionRepo from "../../repositories/gqOtaBookingRevision.repository";
import { logger } from "../../services/logger";
import { assertUserOwnsProperty } from "../property/property.service";
import { AuthenticatedGqUser } from "../../types/express";
import {
  OtaBookingDetailResponseDto,
  OtaBookingResponseDto,
  OtaBookingRevisionResponseDto,
  RevisionProcessingResult,
  toOtaBookingDetailResponseDto,
  toOtaBookingResponseDto,
  toOtaBookingRevisionResponseDto,
} from "./booking.dto";

const MAX_PROCESSING_ATTEMPTS = 10;

interface ResolvedRoomGroup {
  bqRoomTypeName: string;
  quantity: number;
  amount: number;
  checkinDate: string;
  checkoutDate: string;
  numberOfGuests: number;
}

/**
 * Channex's real `customer` object carries `name` and `surname` as separate fields
 * (first/last name) - prefer those directly rather than guessing. Falls back to
 * splitting `name` on the first space only for the rare case it arrives as one
 * combined string with no separate surname at all.
 */
function resolveGuestName(customer: { name?: string; surname?: string } | undefined): {
  firstname: string;
  lastname: string;
  fullName: string;
} {
  const first = (customer?.name ?? "").trim();
  const last = (customer?.surname ?? "").trim();

  if (first && last) {
    return { firstname: first, lastname: last, fullName: `${first} ${last}` };
  }

  const combined = first || last || "Guest";
  const spaceIndex = combined.indexOf(" ");
  if (spaceIndex === -1) {
    return { firstname: combined, lastname: "Guest", fullName: combined };
  }
  return {
    firstname: combined.slice(0, spaceIndex),
    lastname: combined.slice(spaceIndex + 1),
    fullName: combined,
  };
}

function sumOccupancy(room: ChannexBookingRevisionRoom): number {
  const occ = room.occupancy;
  if (!occ) return 1;
  const total = (occ.adults ?? 0) + (occ.children ?? 0) + (occ.infants ?? 0);
  return total > 0 ? total : 1;
}

/**
 * Groups a revision's rooms by resolved BQ room type name, since BQ's booking-creation
 * endpoint takes one room type + a quantity per call, not a mixed cart. Returns null if
 * any room's room_type_id or rate_plan_id can't be resolved to something GQ already
 * knows about on this property - the whole revision is blocked in that case, per this
 * phase's explicit "do not create an incorrect booking" requirement.
 */
async function resolveRoomGroups(
  rooms: ChannexBookingRevisionRoom[],
  bqPropertyId: number,
  correlationId: string
): Promise<{ groups: ResolvedRoomGroup[] } | { unresolved: unknown }> {
  const allRoomTypes = await getBqRoomTypes(correlationId);
  const propertyRoomTypes = allRoomTypes.filter((rt) => rt.propertyid === bqPropertyId);

  const groupsByRoomTypeName = new Map<string, ResolvedRoomGroup>();

  for (const room of rooms) {
    // A null room_type_id/rate_plan_id means Channex itself couldn't resolve this room
    // to anything (its own dashboard flags these bookings "Unmapped Room"/"Unmapped
    // Rate") - treat that as immediately unresolved. Prisma's findUnique() throws on a
    // literal `null` for a unique column rather than returning "not found", so this
    // must be checked before ever calling findRatePlanByCxId(), not after.
    const bqRoomType = room.room_type_id
      ? propertyRoomTypes.find((rt) => rt.cx_room_type_id === room.room_type_id)
      : undefined;
    const ratePlan = room.rate_plan_id ? await ratePlanRepo.findRatePlanByCxId(room.rate_plan_id) : null;

    if (!bqRoomType || !ratePlan || ratePlan.bq_property_id !== bqPropertyId) {
      return {
        unresolved: {
          cxRoomTypeId: room.room_type_id,
          cxRatePlanId: room.rate_plan_id,
          roomTypeResolved: Boolean(bqRoomType),
          ratePlanResolved: Boolean(ratePlan),
        },
      };
    }

    // room.amount is a numeric STRING on the real API (e.g. "181.15") - Number() it
    // explicitly here rather than summing raw, which would silently string-concatenate
    // instead of add for a multi-room-of-the-same-type group.
    const roomAmount = Number(room.amount);

    const existing = groupsByRoomTypeName.get(bqRoomType.roomtypename);
    if (existing) {
      existing.quantity += 1;
      existing.amount += roomAmount;
    } else {
      groupsByRoomTypeName.set(bqRoomType.roomtypename, {
        bqRoomTypeName: bqRoomType.roomtypename,
        quantity: 1,
        amount: roomAmount,
        checkinDate: room.checkin_date,
        checkoutDate: room.checkout_date,
        numberOfGuests: sumOccupancy(room),
      });
    }
  }

  return { groups: Array.from(groupsByRoomTypeName.values()) };
}

/**
 * The single booking-revision processor, shared by the webhook route and the
 * revision-feed recovery script (POST /webhooks/channex and scripts/run-revision-
 * feed.ts both call this) - per this phase's explicit requirement that missed
 * revisions go through the exact same logic as live webhooks, not a separate path.
 *
 * Idempotency: keyed on Channex's own revision id (gq_ota_booking_revision.
 * cx_revision_id is unique) - an already-acked revision is a pure no-op; an
 * already-created BQ booking (gq_ota_booking.bq_bookingid set) is never re-created on
 * a retried "new" revision, even if the local revision row itself was never acked.
 */
export async function processRevision(
  revision: ChannexBookingRevisionAttributes,
  correlationId: string
): Promise<RevisionProcessingResult> {
  const log = (message: string, extra: Record<string, unknown> = {}) =>
    logger.info(message, { correlationId, revisionId: revision.id, cxBookingId: revision.booking_id, ...extra });
  const logErr = (message: string, extra: Record<string, unknown> = {}) =>
    logger.error(message, { correlationId, revisionId: revision.id, cxBookingId: revision.booking_id, ...extra });

  const existingRevisionRow = await revisionRepo.findRevisionByCxId(revision.id);
  if (existingRevisionRow?.ack_status === "acked") {
    log("revision_already_acked_skipping");
    return { outcome: "skipped_already_acked", revisionId: revision.id };
  }

  // Resolve the Channex property to a BQ one. There is no local row to persist this
  // failure against yet (gq_ota_booking.bq_property_id is required, and we have no
  // valid property to satisfy it) - this genuinely-exceptional case (a webhook/revision
  // for a property that was never onboarded, meaning its channel connection couldn't
  // have existed either) is logged clearly instead; Channex's own retry backoff and
  // the revision feed both keep re-surfacing it until it resolves or is manually
  // investigated.
  const properties = await listBqProperties(correlationId);
  const bqProperty = properties.find((p) => p.cx_property_id === revision.property_id);
  if (!bqProperty) {
    logErr("revision_unknown_property", { cxPropertyId: revision.property_id });
    return { outcome: "failed", revisionId: revision.id, reason: "Unknown Channex property - not onboarded in BQ." };
  }

  const otaBooking = await otaBookingRepo.upsertOtaBooking({
    bqPropertyId: bqProperty.propertyid,
    cxBookingId: revision.booking_id,
    otaName: "channex",
    uniqueId: revision.ota_reservation_code ?? revision.booking_id,
    status: revision.status,
    currency: revision.currency,
  });

  const revisionRow =
    existingRevisionRow ??
    (await revisionRepo.createOtaBookingRevision({
      otaBookingId: otaBooking.id,
      cxRevisionId: revision.id,
      status: revision.status,
      arrivalDate: revision.arrival_date,
      departureDate: revision.departure_date,
      amountMinorUnits: toMinorUnits(Number(revision.amount), revision.currency),
      currency: revision.currency,
      guestName: revision.customer ? resolveGuestName(revision.customer).fullName : null,
    }));

  if (revisionRow.processing_attempts >= MAX_PROCESSING_ATTEMPTS) {
    logErr("revision_max_attempts_exceeded");
    return { outcome: "failed", revisionId: revision.id, reason: "Exceeded max processing attempts." };
  }

  async function block(reason: string): Promise<RevisionProcessingResult> {
    await revisionRepo.incrementProcessingAttempts(revisionRow!.id, reason);
    logErr("revision_blocked", { reason });
    return { outcome: "blocked", revisionId: revision.id, reason };
  }

  try {
    if (revision.status === "cancelled") {
      if (!otaBooking.bq_orderid) {
        return await block("No BQ booking exists yet for this Channex booking - nothing to cancel.");
      }
      await cancelBqBooking(otaBooking.bq_orderid, "Cancelled via Channex/OTA", correlationId);
      await otaBookingRepo.setOtaBookingStatus(otaBooking.id, "cancelled");
      await revisionRepo.markRevisionAcked(revisionRow.id);
      await ackChannexRevision(revision.id, correlationId);
      log("revision_cancelled_and_acked");
      return { outcome: "acked", revisionId: revision.id, bqOrderId: otaBooking.bq_orderid };
    }

    if (revision.status === "modified") {
      if (!otaBooking.bq_bookingid) {
        return await block("No BQ booking exists yet for this Channex booking - nothing to modify.");
      }
      const resolved = await resolveRoomGroups(revision.rooms, bqProperty.propertyid, correlationId);
      if ("unresolved" in resolved) {
        return await block(`Unmapped room/rate plan: ${JSON.stringify(resolved.unresolved)}`);
      }
      const primary = resolved.groups[0];
      await modifyBqBooking(
        otaBooking.bq_bookingid,
        { newRoomTypeName: primary.bqRoomTypeName, newCheckinDate: primary.checkinDate, newCheckoutDate: primary.checkoutDate },
        correlationId
      );
      await revisionRepo.markRevisionAcked(revisionRow.id);
      await ackChannexRevision(revision.id, correlationId);
      log("revision_modified_and_acked");
      return { outcome: "acked", revisionId: revision.id, bqBookingId: otaBooking.bq_bookingid };
    }

    // status === "new"
    if (otaBooking.bq_bookingid) {
      // Already created (a retried/duplicate "new" revision) - never create twice.
      await revisionRepo.markRevisionAcked(revisionRow.id);
      await ackChannexRevision(revision.id, correlationId);
      log("revision_new_already_created_acking_only");
      return { outcome: "acked", revisionId: revision.id, bqBookingId: otaBooking.bq_bookingid };
    }

    if (!revision.customer?.mail) {
      return await block("Channex booking has no guest email - BQ requires one to create a reservation.");
    }

    const resolved = await resolveRoomGroups(revision.rooms, bqProperty.propertyid, correlationId);
    if ("unresolved" in resolved) {
      return await block(`Unmapped room/rate plan: ${JSON.stringify(resolved.unresolved)}`);
    }
    if (resolved.groups.length === 0) {
      return await block("Revision has no rooms.");
    }

    const { firstname, lastname } = resolveGuestName(revision.customer);
    const primary = resolved.groups[0];

    const createResult = await createBqBooking(
      {
        guest: { firstname, lastname, emailid: revision.customer.mail, clienttype: "Leisure" },
        booking: {
          checkindate: primary.checkinDate,
          checkoutdate: primary.checkoutDate,
          room_type: primary.bqRoomTypeName,
          number_of_guests: primary.numberOfGuests,
          quantity: primary.quantity,
          booking_type: "OTA",
          booking_status: "Hard",
          fixed_amount: primary.amount,
        },
      },
      correlationId
    );

    if (resolved.groups.length > 1) {
      logErr("revision_multi_room_type_booking_only_primary_group_created", {
        totalGroups: resolved.groups.length,
      });
    }

    const verified = await findBqBookingById(createResult.booking_id, correlationId);
    if (!verified) {
      logErr("revision_bq_booking_verify_failed", { bqBookingId: createResult.booking_id });
    }

    await otaBookingRepo.setBqBookingRef(otaBooking.id, createResult.order_id, createResult.booking_id);
    await revisionRepo.markRevisionAcked(revisionRow.id);
    await ackChannexRevision(revision.id, correlationId);
    log("revision_new_created_and_acked", { bqOrderId: createResult.order_id, bqBookingId: createResult.booking_id });
    return { outcome: "acked", revisionId: revision.id, bqOrderId: createResult.order_id, bqBookingId: createResult.booking_id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return await block(`Processing error: ${message}`);
  }
}

// ---------- Read APIs (list/get) ----------
//
// Mirrors Channex's own Bookings Collection / Booking Revisions Collection APIs
// (docs.channex.io/api-v.1-documentation/bookings-collection), which are read-only too
// - bookings/revisions are only ever created by ingestion (processRevision above), never
// by a direct write here, since that's the whole point of "GQ must not directly modify
// BQ tables" and must not let a booking be fabricated outside the real OTA -> Channex ->
// BQ flow.

async function requireOwnedBooking(user: AuthenticatedGqUser, bookingId: string) {
  const row = await otaBookingRepo.findOtaBookingById(bookingId);
  if (!row) {
    throw bookingNotFoundError();
  }
  assertUserOwnsProperty(user, row.bq_property_id);
  return row;
}

async function requireOwnedRevision(user: AuthenticatedGqUser, revisionId: string) {
  const row = await revisionRepo.findRevisionById(revisionId);
  if (!row) {
    throw bookingRevisionNotFoundError();
  }
  assertUserOwnsProperty(user, row.gq_ota_booking.bq_property_id);
  return row;
}

export async function listBookingsForProperty(
  user: AuthenticatedGqUser,
  propertyId: number,
  status: string | undefined
): Promise<OtaBookingResponseDto[]> {
  assertUserOwnsProperty(user, propertyId);
  const rows = await otaBookingRepo.listOtaBookingsByProperty(propertyId, status);
  return rows.map(toOtaBookingResponseDto);
}

export async function getBookingForProperty(
  user: AuthenticatedGqUser,
  propertyId: number,
  bookingId: string
): Promise<OtaBookingDetailResponseDto> {
  const booking = await requireOwnedBooking(user, bookingId);
  if (booking.bq_property_id !== propertyId) {
    throw bookingNotFoundError();
  }
  const revisions = await revisionRepo.listRevisionsByBookingId(booking.id);
  return toOtaBookingDetailResponseDto(booking, revisions);
}

export async function listBookingRevisionsForProperty(
  user: AuthenticatedGqUser,
  propertyId: number,
  ackStatus: string | undefined
): Promise<OtaBookingRevisionResponseDto[]> {
  assertUserOwnsProperty(user, propertyId);
  const rows = await revisionRepo.listRevisionsByProperty(propertyId, ackStatus);
  return rows.map(toOtaBookingRevisionResponseDto);
}

export async function getBookingRevisionForProperty(
  user: AuthenticatedGqUser,
  propertyId: number,
  revisionId: string
): Promise<OtaBookingRevisionResponseDto> {
  const revision = await requireOwnedRevision(user, revisionId);
  if (revision.gq_ota_booking.bq_property_id !== propertyId) {
    throw bookingRevisionNotFoundError();
  }
  return toOtaBookingRevisionResponseDto(revision);
}
