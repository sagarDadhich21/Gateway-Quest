/**
 * Types for pricing-service's GET /dynamic-prices-calendar, sourced directly from
 * pricing-service/app/api/routes/dynamicpricing.py (QUEST - Copy). Prices are floats
 * in major currency units (e.g. 4500.0), never minor units - conversion happens in GQ
 * (see lib/currency.ts), not here.
 */
export interface PricingServiceDailyPrice {
  date: string; // YYYY-MM-DD
  roomtypename: string;
  baseprice: number;
  dynamicprice: number | null;
  template_applied: string | null;
  has_dynamic_pricing: boolean;
}

export interface PricingServiceRoomTypePrices {
  roomtypename: string;
  prices: PricingServiceDailyPrice[];
}

export interface PricingServiceCalendarResponse {
  status: string;
  date_range: { start: string; end: string; total_days: number };
  room_types: PricingServiceRoomTypePrices[];
}
