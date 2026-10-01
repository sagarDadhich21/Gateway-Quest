import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../repositories/gqPushTask.repository", () => ({ listPushTasks: vi.fn() }));
vi.mock("../../repositories/gqApiLog.repository", () => ({ listApiLogs: vi.fn() }));
vi.mock("../../repositories/gqWebhookLog.repository", () => ({ listWebhookLogs: vi.fn() }));
vi.mock("../../repositories/gqErrorQueue.repository", () => ({ listErrorQueue: vi.fn() }));

import * as apiLogRepo from "../../repositories/gqApiLog.repository";
import * as errorQueueRepo from "../../repositories/gqErrorQueue.repository";
import * as pushTaskRepo from "../../repositories/gqPushTask.repository";
import * as webhookLogRepo from "../../repositories/gqWebhookLog.repository";
import { listApiLogs, listErrorQueue, listPushTasks, listWebhookLogs } from "./monitoring.service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listPushTasks", () => {
  it("maps rows to the response DTO shape", async () => {
    vi.mocked(pushTaskRepo.listPushTasks).mockResolvedValue([
      { id: "t1", task_type: "availability", cx_task_id: "cx-1", status: "confirmed", warnings: null, created_at: new Date("2026-09-30T00:00:00Z") },
    ] as never);

    const result = await listPushTasks(100);

    expect(pushTaskRepo.listPushTasks).toHaveBeenCalledWith(100);
    expect(result).toEqual([
      { id: "t1", taskType: "availability", cxTaskId: "cx-1", status: "confirmed", warnings: null, createdAt: "2026-09-30T00:00:00.000Z" },
    ]);
  });
});

describe("listApiLogs", () => {
  it("maps rows to the response DTO shape", async () => {
    vi.mocked(apiLogRepo.listApiLogs).mockResolvedValue([
      {
        id: "l1",
        method: "GET",
        endpoint: "/properties",
        http_status: 200,
        latency_ms: 120,
        request_body: { params: { "filter[property_id]": "cx-prop-1" }, body: null },
        response_body: { data: [] },
        created_at: new Date("2026-09-30T00:00:00Z"),
      },
    ] as never);

    const result = await listApiLogs(50);

    expect(apiLogRepo.listApiLogs).toHaveBeenCalledWith(50);
    expect(result).toEqual([
      {
        id: "l1",
        method: "GET",
        endpoint: "/properties",
        httpStatus: 200,
        latencyMs: 120,
        requestBody: { params: { "filter[property_id]": "cx-prop-1" }, body: null },
        responseBody: { data: [] },
        createdAt: "2026-09-30T00:00:00.000Z",
      },
    ]);
  });
});

describe("listWebhookLogs", () => {
  it("maps rows to the response DTO shape, including a null nextRetryAt", async () => {
    vi.mocked(webhookLogRepo.listWebhookLogs).mockResolvedValue([
      {
        id: "w1",
        event: "booking_new",
        ref: "cx-booking-1",
        attempt: 1,
        http_status_returned: 200,
        received_at: new Date("2026-09-30T00:00:00Z"),
        next_retry_at: null,
      },
    ] as never);

    const result = await listWebhookLogs(100);

    expect(result).toEqual([
      {
        id: "w1",
        event: "booking_new",
        ref: "cx-booking-1",
        attempt: 1,
        httpStatusReturned: 200,
        receivedAt: "2026-09-30T00:00:00.000Z",
        nextRetryAt: null,
      },
    ]);
  });
});

describe("listErrorQueue", () => {
  it("maps rows to the response DTO shape", async () => {
    vi.mocked(errorQueueRepo.listErrorQueue).mockResolvedValue([
      {
        id: "e1",
        source: "channex_webhook_async_processing",
        payload: { correlationId: "corr-1" },
        error_message: "boom",
        retry_count: 0,
        created_at: new Date("2026-09-30T00:00:00Z"),
      },
    ] as never);

    const result = await listErrorQueue(100);

    expect(result).toEqual([
      {
        id: "e1",
        source: "channex_webhook_async_processing",
        payload: { correlationId: "corr-1" },
        errorMessage: "boom",
        retryCount: 0,
        createdAt: "2026-09-30T00:00:00.000Z",
      },
    ]);
  });
});
