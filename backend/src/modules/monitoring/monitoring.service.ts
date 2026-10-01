import * as apiLogRepo from "../../repositories/gqApiLog.repository";
import * as errorQueueRepo from "../../repositories/gqErrorQueue.repository";
import * as pushTaskRepo from "../../repositories/gqPushTask.repository";
import * as webhookLogRepo from "../../repositories/gqWebhookLog.repository";
import {
  ApiLogResponseDto,
  ErrorQueueResponseDto,
  PushTaskResponseDto,
  toApiLogResponseDto,
  toErrorQueueResponseDto,
  toPushTaskResponseDto,
  toWebhookLogResponseDto,
  WebhookLogResponseDto,
} from "./monitoring.dto";

/**
 * Every list here is a plain, unfiltered, account-wide audit trail (none of these 4
 * tables carry a bq_property_id) - Super_Admin only, same reasoning as account-config:
 * this is operational data about GQ's own integration health, not something scoped to
 * a single property's staff.
 */
export async function listPushTasks(limit: number): Promise<PushTaskResponseDto[]> {
  const rows = await pushTaskRepo.listPushTasks(limit);
  return rows.map(toPushTaskResponseDto);
}

export async function listApiLogs(limit: number): Promise<ApiLogResponseDto[]> {
  const rows = await apiLogRepo.listApiLogs(limit);
  return rows.map(toApiLogResponseDto);
}

export async function listWebhookLogs(limit: number): Promise<WebhookLogResponseDto[]> {
  const rows = await webhookLogRepo.listWebhookLogs(limit);
  return rows.map(toWebhookLogResponseDto);
}

export async function listErrorQueue(limit: number): Promise<ErrorQueueResponseDto[]> {
  const rows = await errorQueueRepo.listErrorQueue(limit);
  return rows.map(toErrorQueueResponseDto);
}
