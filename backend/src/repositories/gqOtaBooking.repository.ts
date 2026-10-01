import { gq_ota_booking } from "@prisma/client";
import { prisma } from "./prismaClient";

export interface UpsertOtaBookingInput {
  bqPropertyId: number;
  cxBookingId: string;
  otaName: string;
  uniqueId: string;
  status: string;
  currency: string;
}

/** Keyed on cx_booking_id (unique) - the same Channex booking across multiple revisions always resolves to one row. */
export async function upsertOtaBooking(input: UpsertOtaBookingInput): Promise<gq_ota_booking> {
  return prisma.gq_ota_booking.upsert({
    where: { cx_booking_id: input.cxBookingId },
    create: {
      bq_property_id: input.bqPropertyId,
      cx_booking_id: input.cxBookingId,
      ota_name: input.otaName,
      unique_id: input.uniqueId,
      status: input.status,
      currency: input.currency,
    },
    update: {
      status: input.status,
      updated_at: new Date(),
    },
  });
}

export async function findOtaBookingByCxId(cxBookingId: string): Promise<gq_ota_booking | null> {
  return prisma.gq_ota_booking.findUnique({ where: { cx_booking_id: cxBookingId } });
}

export async function setBqBookingRef(
  id: string,
  bqOrderId: string,
  bqBookingId: string
): Promise<gq_ota_booking> {
  return prisma.gq_ota_booking.update({
    where: { id },
    data: { bq_orderid: bqOrderId, bq_bookingid: bqBookingId, updated_at: new Date() },
  });
}

export async function setOtaBookingStatus(id: string, status: string): Promise<gq_ota_booking> {
  return prisma.gq_ota_booking.update({ where: { id }, data: { status, updated_at: new Date() } });
}

export async function listOtaBookingsByProperty(bqPropertyId: number, status?: string): Promise<gq_ota_booking[]> {
  return prisma.gq_ota_booking.findMany({
    where: { bq_property_id: bqPropertyId, ...(status ? { status } : {}) },
    orderBy: { created_at: "desc" },
  });
}

export async function findOtaBookingById(id: string): Promise<gq_ota_booking | null> {
  return prisma.gq_ota_booking.findUnique({ where: { id } });
}
