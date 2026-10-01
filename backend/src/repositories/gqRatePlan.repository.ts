import { gq_rate_plan, gq_rate_plan_option } from "@prisma/client";
import { prisma } from "./prismaClient";

export type RatePlanWithOptions = gq_rate_plan & { gq_rate_plan_option: gq_rate_plan_option[] };

const withOptions = { gq_rate_plan_option: true } as const;

export interface RatePlanOptionInput {
  occupancy: number;
  isPrimary: boolean;
}

export interface CreateRatePlanInput {
  bqPropertyId: number;
  bqRoomTypeId: number;
  name: string;
  currency: string;
  sellMode: string;
  rateMode: string;
  mealType?: string;
  parentRatePlanId: string | null;
  isDefault: boolean;
  options: RatePlanOptionInput[];
}

/** Every option's `rate` is always persisted as 0 - real rates are pushed later via ARI, not implemented here. */
export async function createRatePlan(input: CreateRatePlanInput): Promise<RatePlanWithOptions> {
  return prisma.gq_rate_plan.create({
    data: {
      bq_property_id: input.bqPropertyId,
      bq_room_type_id: input.bqRoomTypeId,
      name: input.name,
      currency: input.currency,
      sell_mode: input.sellMode,
      rate_mode: input.rateMode,
      meal_type: input.mealType,
      parent_rate_plan_id: input.parentRatePlanId,
      is_default: input.isDefault,
      gq_rate_plan_option: {
        create: input.options.map((o) => ({
          occupancy: o.occupancy,
          is_primary: o.isPrimary,
          rate: 0,
        })),
      },
    },
    include: withOptions,
  });
}

export async function findRatePlanById(id: string): Promise<RatePlanWithOptions | null> {
  return prisma.gq_rate_plan.findUnique({ where: { id }, include: withOptions });
}

/** Used for create-time idempotency: the same room type + name is treated as the same rate plan. */
export async function findRatePlanByRoomTypeAndName(
  bqRoomTypeId: number,
  name: string
): Promise<RatePlanWithOptions | null> {
  return prisma.gq_rate_plan.findFirst({
    where: { bq_room_type_id: bqRoomTypeId, name },
    include: withOptions,
  });
}

/** Resolves a Channex rate_plan_id (from a booking revision) back to the GQ rate plan it belongs to. */
export async function findRatePlanByCxId(cxRatePlanId: string): Promise<RatePlanWithOptions | null> {
  return prisma.gq_rate_plan.findUnique({ where: { cx_rate_plan_id: cxRatePlanId }, include: withOptions });
}

export interface ListRatePlansFilter {
  bqPropertyId?: number;
  bqRoomTypeId?: number;
}

export async function listRatePlans(filter: ListRatePlansFilter): Promise<RatePlanWithOptions[]> {
  return prisma.gq_rate_plan.findMany({
    where: {
      bq_property_id: filter.bqPropertyId,
      bq_room_type_id: filter.bqRoomTypeId,
    },
    include: withOptions,
    orderBy: { created_at: "asc" },
  });
}

export async function setRatePlanCxId(id: string, cxRatePlanId: string): Promise<RatePlanWithOptions> {
  return prisma.gq_rate_plan.update({
    where: { id },
    data: { cx_rate_plan_id: cxRatePlanId },
    include: withOptions,
  });
}

export interface UpdateRatePlanFields {
  name?: string;
  currency?: string;
  sellMode?: string;
  rateMode?: string;
  mealType?: string;
  isDefault?: boolean;
}

export async function updateRatePlanFields(
  id: string,
  patch: UpdateRatePlanFields
): Promise<RatePlanWithOptions> {
  return prisma.gq_rate_plan.update({
    where: { id },
    data: {
      name: patch.name,
      currency: patch.currency,
      sell_mode: patch.sellMode,
      rate_mode: patch.rateMode,
      meal_type: patch.mealType,
      is_default: patch.isDefault,
      updated_at: new Date(),
    },
    include: withOptions,
  });
}

/** Replaces the full option set, mirroring BQ's own update_roomtype convention (delete_many then recreate) rather than diffing. */
export async function replaceRatePlanOptions(
  id: string,
  options: RatePlanOptionInput[]
): Promise<RatePlanWithOptions> {
  await prisma.$transaction([
    prisma.gq_rate_plan_option.deleteMany({ where: { rate_plan_id: id } }),
    prisma.gq_rate_plan_option.createMany({
      data: options.map((o) => ({
        rate_plan_id: id,
        occupancy: o.occupancy,
        is_primary: o.isPrimary,
        rate: 0,
      })),
    }),
  ]);
  const updated = await prisma.gq_rate_plan.update({
    where: { id },
    data: { updated_at: new Date() },
    include: withOptions,
  });
  return updated;
}

/** A rate plan that another rate plan's parent_rate_plan_id points at cannot be deleted (FK is onDelete: NoAction). */
export async function countChildRatePlans(id: string): Promise<number> {
  return prisma.gq_rate_plan.count({ where: { parent_rate_plan_id: id } });
}

export async function deleteRatePlan(id: string): Promise<void> {
  await prisma.$transaction([
    prisma.gq_rate_plan_option.deleteMany({ where: { rate_plan_id: id } }),
    prisma.gq_rate_plan.delete({ where: { id } }),
  ]);
}
