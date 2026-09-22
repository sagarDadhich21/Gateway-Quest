import { prisma } from "./prismaClient";

export interface CreatePushTaskInput {
  taskType: "availability" | "restrictions";
  cxTaskId: string;
  warnings?: unknown;
}

/**
 * Records the Channex task id returned by an ARI push (POST /availability or
 * POST /restrictions both return `{data: [{id, type: "task"}]}` - the push is
 * processed asynchronously on Channex's side). This is an audit trail only in this
 * phase - polling/consuming task completion is not implemented here (webhooks/queues
 * are explicitly out of scope for this phase).
 */
export async function createPushTask(input: CreatePushTaskInput): Promise<void> {
  await prisma.gq_push_task.create({
    data: {
      task_type: input.taskType,
      cx_task_id: input.cxTaskId,
      status: "pending",
      warnings: input.warnings as never,
    },
  });
}

/**
 * Updates a push task's status once GQ has read the value back from Channex to
 * confirm it landed (see ari.service.ts) - "confirmed" when the read-back matches what
 * was pushed, "unconfirmed" when it doesn't (Channex processes pushes asynchronously,
 * so this is a best-effort check, not proof of failure).
 */
export async function updatePushTaskStatus(
  cxTaskId: string,
  status: "confirmed" | "unconfirmed"
): Promise<void> {
  await prisma.gq_push_task.updateMany({
    where: { cx_task_id: cxTaskId },
    data: { status },
  });
}
