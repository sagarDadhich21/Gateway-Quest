import { gq_api_log } from "@prisma/client";
import { prisma } from "./prismaClient";

export interface LogApiCallInput {
  method: string;
  endpoint: string;
  httpStatus: number;
  latencyMs: number;
  /** Pre-redacted by the caller (see channex.client.ts's redact()) - never the raw API key or unmasked card/payment data. */
  requestBody?: unknown;
  responseBody?: unknown;
}

/**
 * Records one outbound call GQ made to Channex, matching gq_api_log's actual purpose
 * (per-call audit, not a general-purpose event log). Callers must redact sensitive
 * fields before passing request/response bodies here - this function does not do it.
 */
export async function logApiCall(input: LogApiCallInput): Promise<void> {
  await prisma.gq_api_log.create({
    data: {
      method: input.method,
      endpoint: input.endpoint,
      http_status: input.httpStatus,
      latency_ms: input.latencyMs,
      request_body: input.requestBody as never,
      response_body: input.responseBody as never,
    },
  });
}

export async function listApiLogs(limit: number): Promise<gq_api_log[]> {
  return prisma.gq_api_log.findMany({ orderBy: { created_at: "desc" }, take: limit });
}
