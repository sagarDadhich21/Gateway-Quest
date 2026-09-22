import { gq_availability_snapshot } from "@prisma/client";
import { prisma } from "./prismaClient";

export interface UpsertAvailabilitySnapshotInput {
  bqPropertyId: number;
  bqRoomTypeId: number;
  date: string; // YYYY-MM-DD
  availableRooms: number;
}

/**
 * Records the last availability value GQ pushed to Channex for a (room type, date),
 * matching gq_availability_snapshot's @@unique([bq_room_type_id, date]) constraint -
 * a repeated push for the same room type + date updates the same row rather than
 * creating a duplicate, which is what keeps the ARI availability push idempotent at
 * the GQ persistence layer.
 */
export async function upsertAvailabilitySnapshot(
  input: UpsertAvailabilitySnapshotInput
): Promise<gq_availability_snapshot> {
  return prisma.gq_availability_snapshot.upsert({
    where: {
      bq_room_type_id_date: {
        bq_room_type_id: input.bqRoomTypeId,
        date: new Date(`${input.date}T00:00:00Z`),
      },
    },
    create: {
      bq_property_id: input.bqPropertyId,
      bq_room_type_id: input.bqRoomTypeId,
      date: new Date(`${input.date}T00:00:00Z`),
      available_rooms: input.availableRooms,
    },
    update: {
      available_rooms: input.availableRooms,
      updated_at: new Date(),
    },
  });
}

export interface ListAvailabilitySnapshotsFilter {
  bqPropertyId: number;
  bqRoomTypeId?: number;
  dateFrom: string;
  dateTo: string;
}

export async function listAvailabilitySnapshots(
  filter: ListAvailabilitySnapshotsFilter
): Promise<gq_availability_snapshot[]> {
  return prisma.gq_availability_snapshot.findMany({
    where: {
      bq_property_id: filter.bqPropertyId,
      bq_room_type_id: filter.bqRoomTypeId,
      date: {
        gte: new Date(`${filter.dateFrom}T00:00:00Z`),
        lte: new Date(`${filter.dateTo}T00:00:00Z`),
      },
    },
    orderBy: [{ bq_room_type_id: "asc" }, { date: "asc" }],
  });
}
