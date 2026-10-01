import { gq_api_log, gq_error_queue, gq_push_task, gq_webhook_log } from "@prisma/client";

export interface PushTaskResponseDto {
  id: string;
  taskType: string;
  cxTaskId: string;
  status: string;
  warnings: unknown;
  createdAt: string;
}

export interface ApiLogResponseDto {
  id: string;
  method: string;
  endpoint: string;
  httpStatus: number;
  latencyMs: number;
  requestBody: unknown;
  responseBody: unknown;
  createdAt: string;
}

export interface WebhookLogResponseDto {
  id: string;
  event: string;
  ref: string;
  attempt: number;
  httpStatusReturned: number | null;
  receivedAt: string;
  nextRetryAt: string | null;
}

export interface ErrorQueueResponseDto {
  id: string;
  source: string;
  payload: unknown;
  errorMessage: string;
  retryCount: number;
  createdAt: string;
}

export function toPushTaskResponseDto(row: gq_push_task): PushTaskResponseDto {
  return {
    id: row.id,
    taskType: row.task_type,
    cxTaskId: row.cx_task_id,
    status: row.status,
    warnings: row.warnings,
    createdAt: row.created_at.toISOString(),
  };
}

export function toApiLogResponseDto(row: gq_api_log): ApiLogResponseDto {
  return {
    id: row.id,
    method: row.method,
    endpoint: row.endpoint,
    httpStatus: row.http_status,
    latencyMs: row.latency_ms,
    requestBody: row.request_body,
    responseBody: row.response_body,
    createdAt: row.created_at.toISOString(),
  };
}

export function toWebhookLogResponseDto(row: gq_webhook_log): WebhookLogResponseDto {
  return {
    id: row.id,
    event: row.event,
    ref: row.ref,
    attempt: row.attempt,
    httpStatusReturned: row.http_status_returned,
    receivedAt: row.received_at.toISOString(),
    nextRetryAt: row.next_retry_at ? row.next_retry_at.toISOString() : null,
  };
}

export function toErrorQueueResponseDto(row: gq_error_queue): ErrorQueueResponseDto {
  return {
    id: row.id,
    source: row.source,
    payload: row.payload,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    createdAt: row.created_at.toISOString(),
  };
}
