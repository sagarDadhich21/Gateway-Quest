import { prisma } from "./prismaClient";

export interface LogApiCallInput {
  method: string;
  endpoint: string;
  httpStatus: number;
  latencyMs: number;
}

/**
 * Records one outbound call GQ made to Channex, matching gq_api_log's actual purpose
 * (per-call audit, not a general-purpose event log). Never pass the API key or request
 * body here.
 */
export async function logApiCall(input: LogApiCallInput): Promise<void> {
  await prisma.gq_api_log.create({
    data: {
      method: input.method,
      endpoint: input.endpoint,
      http_status: input.httpStatus,
      latency_ms: input.latencyMs,
    },
  });
}
