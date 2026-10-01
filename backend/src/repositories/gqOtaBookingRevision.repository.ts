import { gq_ota_booking, gq_ota_booking_revision } from "@prisma/client";
import { prisma } from "./prismaClient";

export interface CreateOtaBookingRevisionInput {
  otaBookingId: string;
  cxRevisionId: string;
  status: string;
  // YYYY-MM-DD, or null - Booking.com cancellation notices in particular sometimes omit
  // stay dates entirely (confirmed on a real live revision, not a hypothetical).
  arrivalDate: string | null;
  departureDate: string | null;
  amountMinorUnits: number;
  currency: string;
  guestName?: string | null;
}

function toDateOnly(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00Z`) : null;
}

/** cx_revision_id is unique - this is GQ's own idempotency guard, checked by the caller via findRevisionByCxId before ever calling BQ (see booking.service.ts processRevision). */
export async function createOtaBookingRevision(
  input: CreateOtaBookingRevisionInput
): Promise<gq_ota_booking_revision> {
  return prisma.gq_ota_booking_revision.create({
    data: {
      ota_booking_id: input.otaBookingId,
      cx_revision_id: input.cxRevisionId,
      status: input.status,
      arrival_date: toDateOnly(input.arrivalDate),
      departure_date: toDateOnly(input.departureDate),
      amount_minor_units: input.amountMinorUnits,
      currency: input.currency,
      guest_name: input.guestName ?? null,
      received_at: new Date(),
    },
  });
}

export async function findRevisionByCxId(cxRevisionId: string): Promise<gq_ota_booking_revision | null> {
  return prisma.gq_ota_booking_revision.findUnique({ where: { cx_revision_id: cxRevisionId } });
}

export async function incrementProcessingAttempts(id: string, blockingReason: string): Promise<gq_ota_booking_revision> {
  return prisma.gq_ota_booking_revision.update({
    where: { id },
    data: { processing_attempts: { increment: 1 }, blocking_reason: blockingReason },
  });
}

export async function markRevisionAcked(id: string): Promise<gq_ota_booking_revision> {
  return prisma.gq_ota_booking_revision.update({
    where: { id },
    data: { ack_status: "acked", acked_at: new Date(), blocking_reason: null },
  });
}

/** Revisions still awaiting successful processing - what the revision-feed recovery script re-drives through the same processing service. */
export async function listUnackedRevisions(): Promise<gq_ota_booking_revision[]> {
  return prisma.gq_ota_booking_revision.findMany({
    where: { ack_status: { not: "acked" } },
    orderBy: { received_at: "asc" },
  });
}

export async function listRevisionsByBookingId(otaBookingId: string): Promise<gq_ota_booking_revision[]> {
  return prisma.gq_ota_booking_revision.findMany({
    where: { ota_booking_id: otaBookingId },
    orderBy: { received_at: "desc" },
  });
}

/** Property-wide revision list (across every booking on the property) - joins through gq_ota_booking, which is the only place bq_property_id lives. Useful to find stuck/blocked revisions without knowing their booking id up front. */
export async function listRevisionsByProperty(
  bqPropertyId: number,
  ackStatus?: string
): Promise<(gq_ota_booking_revision & { gq_ota_booking: gq_ota_booking })[]> {
  return prisma.gq_ota_booking_revision.findMany({
    where: {
      gq_ota_booking: { bq_property_id: bqPropertyId },
      ...(ackStatus ? { ack_status: ackStatus } : {}),
    },
    include: { gq_ota_booking: true },
    orderBy: { received_at: "desc" },
  });
}

export async function findRevisionById(
  id: string
): Promise<(gq_ota_booking_revision & { gq_ota_booking: gq_ota_booking }) | null> {
  return prisma.gq_ota_booking_revision.findUnique({ where: { id }, include: { gq_ota_booking: true } });
}
