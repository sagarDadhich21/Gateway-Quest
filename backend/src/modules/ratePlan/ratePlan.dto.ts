import { RatePlanWithOptions } from "../../repositories/gqRatePlan.repository";

export interface RatePlanOptionDto {
  id: string;
  occupancy: number;
  isPrimary: boolean;
  rate: number | null;
}

/**
 * What the GQ UI needs for a rate plan. `channex.onboarded`/`ratePlanId` mirror
 * property.dto.ts's convention of deriving Channex state from the one field GQ stores
 * for it (`cx_rate_plan_id`) rather than tracking a separate onboarded flag.
 */
export interface RatePlanResponseDto {
  id: string;
  propertyId: number;
  roomTypeId: number;
  name: string;
  currency: string;
  sellMode: string;
  rateMode: string;
  mealType: string | null;
  parentRatePlanId: string | null;
  isDefault: boolean;
  channex: {
    onboarded: boolean;
    ratePlanId: string | null;
  };
  options: RatePlanOptionDto[];
  createdAt: string;
  updatedAt: string;
}

export function toRatePlanResponseDto(row: RatePlanWithOptions): RatePlanResponseDto {
  return {
    id: row.id,
    propertyId: row.bq_property_id,
    roomTypeId: row.bq_room_type_id,
    name: row.name,
    currency: row.currency,
    sellMode: row.sell_mode,
    rateMode: row.rate_mode,
    mealType: row.meal_type,
    parentRatePlanId: row.parent_rate_plan_id,
    isDefault: row.is_default,
    channex: {
      onboarded: row.cx_rate_plan_id !== null,
      ratePlanId: row.cx_rate_plan_id,
    },
    options: row.gq_rate_plan_option.map((o) => ({
      id: o.id,
      occupancy: o.occupancy,
      isPrimary: o.is_primary,
      rate: o.rate,
    })),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
