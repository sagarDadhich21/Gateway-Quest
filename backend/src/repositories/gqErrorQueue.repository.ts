import { gq_error_queue } from "@prisma/client";
import { prisma } from "./prismaClient";

export interface CreateErrorQueueEntryInput {
  source: string;
  payload: Record<string, unknown>;
  errorMessage: string;
}

/**
 * Records a failure that has no other persisted record and would otherwise be visible
 * only in stdout logs - currently written from the webhook's fire-and-forget async
 * processing catch block (booking.routes.ts), the one place in the app where an error
 * is logged and then silently dropped with nothing else to inspect it by later. Never
 * pass secrets/card data in `payload`, same rule as everywhere else this app logs.
 */
export async function createErrorQueueEntry(input: CreateErrorQueueEntryInput): Promise<void> {
  await prisma.gq_error_queue.create({
    data: {
      source: input.source,
      payload: input.payload as never,
      error_message: input.errorMessage,
    },
  });
}

export async function listErrorQueue(limit: number): Promise<gq_error_queue[]> {
  return prisma.gq_error_queue.findMany({ orderBy: { created_at: "desc" }, take: limit });
}
