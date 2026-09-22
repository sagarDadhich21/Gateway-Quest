import { gq_availability_snapshot, gq_rate_restriction } from "@prisma/client";
import { BqDailyAvailability } from "../../clients/bq/bq.types";

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);

export interface RestrictionDto {
  ratePlanId: string;
  date: string;
  rate: number;
  minStayArrival: number | null;
  minStayThrough: number | null;
  minStay: number | null;
  maxStay: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  stopSell: boolean;
  updatedAt: string;
}

export function toRestrictionDto(row: gq_rate_restriction): RestrictionDto {
  return {
    ratePlanId: row.rate_plan_id,
    date: toIsoDate(row.date),
    rate: row.rate,
    minStayArrival: row.min_stay_arrival,
    minStayThrough: row.min_stay_through,
    minStay: row.min_stay,
    maxStay: row.max_stay,
    closedToArrival: row.closed_to_arrival ?? false,
    closedToDeparture: row.closed_to_departure ?? false,
    stopSell: row.stop_sell ?? false,
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface AvailabilitySnapshotDto {
  roomTypeId: number;
  date: string;
  availableRooms: number;
  updatedAt: string;
}

export function toAvailabilitySnapshotDto(row: gq_availability_snapshot): AvailabilitySnapshotDto {
  return {
    roomTypeId: row.bq_room_type_id,
    date: toIsoDate(row.date),
    availableRooms: row.available_rooms,
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface DailyAvailabilityDto {
  roomTypeId: number;
  date: string;
  totalRooms: number;
  bookedRooms: number;
  availableRooms: number;
}

export function toDailyAvailabilityDto(row: BqDailyAvailability): DailyAvailabilityDto {
  return {
    roomTypeId: row.roomTypeId,
    date: row.date,
    totalRooms: row.totalRooms,
    bookedRooms: row.bookedRooms,
    availableRooms: row.availableRooms,
  };
}
