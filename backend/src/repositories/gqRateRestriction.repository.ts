import { gq_rate_restriction } from "@prisma/client";
import { prisma } from "./prismaClient";

export interface UpsertRateRestrictionInput {
  bqPropertyId: number;
  ratePlanId: string;
  date: string; // YYYY-MM-DD
  rate: number; // minor currency units
  minStayArrival?: number;
  minStayThrough?: number;
  minStay?: number;
  maxStay?: number;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  stopSell?: boolean;
}

/**
 * Records the last restriction row GQ pushed to Channex for a (rate plan, date),
 * matching gq_rate_restriction's @@unique([rate_plan_id, date]) constraint - a
 * repeated push for the same rate plan + date updates the same row rather than
 * creating a duplicate, which is what keeps the ARI restrictions push idempotent at
 * the GQ persistence layer.
 */
export async function upsertRateRestriction(
  input: UpsertRateRestrictionInput
): Promise<gq_rate_restriction> {
  return prisma.gq_rate_restriction.upsert({
    where: {
      rate_plan_id_date: {
        rate_plan_id: input.ratePlanId,
        date: new Date(`${input.date}T00:00:00Z`),
      },
    },
    create: {
      bq_property_id: input.bqPropertyId,
      rate_plan_id: input.ratePlanId,
      date: new Date(`${input.date}T00:00:00Z`),
      rate: input.rate,
      min_stay_arrival: input.minStayArrival,
      min_stay_through: input.minStayThrough,
      min_stay: input.minStay,
      max_stay: input.maxStay,
      closed_to_arrival: input.closedToArrival ?? false,
      closed_to_departure: input.closedToDeparture ?? false,
      stop_sell: input.stopSell ?? false,
    },
    update: {
      rate: input.rate,
      min_stay_arrival: input.minStayArrival,
      min_stay_through: input.minStayThrough,
      min_stay: input.minStay,
      max_stay: input.maxStay,
      closed_to_arrival: input.closedToArrival ?? false,
      closed_to_departure: input.closedToDeparture ?? false,
      stop_sell: input.stopSell ?? false,
      updated_at: new Date(),
    },
  });
}

export interface ListRateRestrictionsFilter {
  bqPropertyId: number;
  ratePlanId?: string;
  dateFrom: string;
  dateTo: string;
}

export async function listRateRestrictions(
  filter: ListRateRestrictionsFilter
): Promise<gq_rate_restriction[]> {
  return prisma.gq_rate_restriction.findMany({
    where: {
      bq_property_id: filter.bqPropertyId,
      rate_plan_id: filter.ratePlanId,
      date: {
        gte: new Date(`${filter.dateFrom}T00:00:00Z`),
        lte: new Date(`${filter.dateTo}T00:00:00Z`),
      },
    },
    orderBy: [{ rate_plan_id: "asc" }, { date: "asc" }],
  });
}
