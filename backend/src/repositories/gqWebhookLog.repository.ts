import { gq_webhook_log } from "@prisma/client";
import { prisma } from "./prismaClient";

export interface CreateWebhookLogInput {
  event: string;
  ref: string;
  httpStatusReturned: number;
}

/**
 * Records one accepted incoming Channex webhook call (booking.routes.ts, after the
 * shared-secret check passes). `attempt` counts how many times this same `ref`
 * (Channex booking/revision id, or the event name for non-booking events) has been
 * seen before - Channex's own webhook payload carries no attempt/retry number of its
 * own, so this is GQ's own best-effort count, not something read from Channex.
 */
export async function createWebhookLog(input: CreateWebhookLogInput): Promise<void> {
  const priorCount = await prisma.gq_webhook_log.count({ where: { ref: input.ref } });
  await prisma.gq_webhook_log.create({
    data: {
      event: input.event,
      ref: input.ref,
      attempt: priorCount + 1,
      http_status_returned: input.httpStatusReturned,
    },
  });
}

export async function listWebhookLogs(limit: number): Promise<gq_webhook_log[]> {
  return prisma.gq_webhook_log.findMany({ orderBy: { received_at: "desc" }, take: limit });
}
