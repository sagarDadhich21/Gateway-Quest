import { gq_ota_booking, gq_ota_booking_revision } from "@prisma/client";

export type RevisionProcessingResult =
  | { outcome: "acked"; revisionId: string; bqOrderId?: string; bqBookingId?: string }
  | { outcome: "skipped_already_acked"; revisionId: string }
  | { outcome: "blocked"; revisionId: string; reason: string }
  | { outcome: "failed"; revisionId: string; reason: string };

export interface WebhookResponseDto {
  received: boolean;
}

export interface OtaBookingResponseDto {
  id: string;
  bqPropertyId: number;
  cxBookingId: string;
  otaName: string;
  uniqueId: string;
  status: string;
  currency: string;
  bqOrderId: string | null;
  bqBookingId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OtaBookingRevisionResponseDto {
  id: string;
  otaBookingId: string;
  cxRevisionId: string;
  status: string;
  arrivalDate: string | null;
  departureDate: string | null;
  amountMinorUnits: number;
  currency: string;
  guestName: string | null;
  ackStatus: string;
  blockingReason: string | null;
  processingAttempts: number;
  receivedAt: string;
  ackedAt: string | null;
}

export interface OtaBookingDetailResponseDto extends OtaBookingResponseDto {
  revisions: OtaBookingRevisionResponseDto[];
}

function toDateOnly(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function toOtaBookingResponseDto(row: gq_ota_booking): OtaBookingResponseDto {
  return {
    id: row.id,
    bqPropertyId: row.bq_property_id,
    cxBookingId: row.cx_booking_id,
    otaName: row.ota_name,
    uniqueId: row.unique_id,
    status: row.status,
    currency: row.currency,
    bqOrderId: row.bq_orderid,
    bqBookingId: row.bq_bookingid,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toOtaBookingRevisionResponseDto(row: gq_ota_booking_revision): OtaBookingRevisionResponseDto {
  return {
    id: row.id,
    otaBookingId: row.ota_booking_id,
    cxRevisionId: row.cx_revision_id,
    status: row.status,
    arrivalDate: toDateOnly(row.arrival_date),
    departureDate: toDateOnly(row.departure_date),
    amountMinorUnits: row.amount_minor_units,
    currency: row.currency,
    guestName: row.guest_name,
    ackStatus: row.ack_status,
    blockingReason: row.blocking_reason,
    processingAttempts: row.processing_attempts,
    receivedAt: row.received_at.toISOString(),
    ackedAt: row.acked_at ? row.acked_at.toISOString() : null,
  };
}

export function toOtaBookingDetailResponseDto(
  booking: gq_ota_booking,
  revisions: gq_ota_booking_revision[]
): OtaBookingDetailResponseDto {
  return {
    ...toOtaBookingResponseDto(booking),
    revisions: revisions.map(toOtaBookingRevisionResponseDto),
  };
}
