import axios, { AxiosError, AxiosInstance } from "axios";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { logger } from "../../services/logger";
import { PricingServiceCalendarResponse } from "./pricingService.types";

const pricingHttp: AxiosInstance = axios.create({
  baseURL: env.PRICING_SERVICE_BASE_URL,
  timeout: env.UPSTREAM_TIMEOUT_MS,
});

function toUpstreamError(err: unknown, correlationId: string): AppError {
  const axiosErr = err as AxiosError<{ detail?: string }>;

  if (axiosErr.isAxiosError && !axiosErr.response) {
    logger.error("upstream_unreachable", {
      correlationId,
      upstream: "pricing-service",
      message: axiosErr.message,
    });
    return new AppError(
      "PRICING_SERVICE_UPSTREAM_UNAVAILABLE",
      502,
      "pricing-service is currently unavailable. Please try again shortly."
    );
  }

  const status = axiosErr.response?.status ?? 500;
  const detail = axiosErr.response?.data?.detail;
  logger.error("upstream_error", { correlationId, upstream: "pricing-service", status, detail });
  return new AppError(
    "PRICING_SERVICE_UPSTREAM_ERROR",
    status >= 400 && status < 500 ? status : 502,
    `pricing-service rejected the request${detail ? `: ${detail}` : "."}`
  );
}

/**
 * Reads rates from pricing-service for a date range, per this phase's explicit
 * requirement ("read pricing from the existing pricing-service API for rates").
 *
 * GET /dynamic-prices-calendar used to hardcode `propertyid = 1` server-side
 * (pricing-service/app/api/routes/dynamicpricing.py, QUEST - Copy) and ignore any
 * property scoping entirely - fixed upstream alongside this change by adding a
 * `propertyid` query parameter (default 1, preserving the endpoint's old behavior for
 * any other caller that doesn't pass it). GQ now always passes its own propertyId
 * explicitly rather than relying on that default.
 */
export async function getDynamicPricesCalendar(
  bqPropertyId: number,
  dateFrom: string,
  dateTo: string,
  correlationId: string
): Promise<PricingServiceCalendarResponse> {
  try {
    const response = await pricingHttp.get<PricingServiceCalendarResponse>(
      "/dynamic-prices-calendar",
      { params: { start_date: dateFrom, end_date: dateTo, propertyid: bqPropertyId } }
    );
    return response.data;
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.status === 404) {
      return { status: "success", date_range: { start: dateFrom, end: dateTo, total_days: 0 }, room_types: [] };
    }
    throw toUpstreamError(err, correlationId);
  }
}
