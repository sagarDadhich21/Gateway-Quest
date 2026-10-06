import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../repositories/gqAccountConfig.repository", () => ({
  findActiveWebhookSecrets: vi.fn(),
}));
vi.mock("../../repositories/gqWebhookLog.repository", () => ({
  createWebhookLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../repositories/gqErrorQueue.repository", () => ({
  createErrorQueueEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../clients/channex/channex.client", () => ({
  getChannexBooking: vi.fn().mockResolvedValue({ data: { attributes: {} } }),
  getChannexRevisionFeed: vi.fn(),
}));
vi.mock("./booking.service", () => ({
  processRevision: vi.fn().mockResolvedValue({ outcome: "skipped_already_acked", revisionId: "x" }),
}));

import { findActiveWebhookSecrets } from "../../repositories/gqAccountConfig.repository";
import { createWebhookLog } from "../../repositories/gqWebhookLog.repository";
import { createErrorQueueEntry } from "../../repositories/gqErrorQueue.repository";
import { getChannexRevisionFeed } from "../../clients/channex/channex.client";
import { processRevision } from "./booking.service";
import { createApp } from "../../app";

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

const REAL_SECRET = "correct-secret";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findActiveWebhookSecrets).mockResolvedValue([REAL_SECRET]);
});

describe("POST /api/gq/webhooks/channex - authentication", () => {
  it("rejects a request with no webhook-secret header at all", async () => {
    const app = createApp();
    const res = await request(app).post("/api/gq/webhooks/channex").send({ event: "booking" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("WEBHOOK_UNAUTHORIZED");
  });

  it("rejects a request with the wrong webhook-secret header", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/gq/webhooks/channex")
      .set("x-channex-webhook-secret", "totally-wrong")
      .send({ event: "booking" });

    expect(res.status).toBe(401);
  });

  it("rejects every request when no active webhook secret is configured at all", async () => {
    vi.mocked(findActiveWebhookSecrets).mockResolvedValue([]);

    const app = createApp();
    const res = await request(app)
      .post("/api/gq/webhooks/channex")
      .set("x-channex-webhook-secret", REAL_SECRET)
      .send({ event: "booking" });

    expect(res.status).toBe(401);
  });

  it("accepts a request with the correct webhook-secret header", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/gq/webhooks/channex")
      .set("x-channex-webhook-secret", REAL_SECRET)
      .send({ event: "booking", payload: { booking_id: "b1" } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it("does not require a normal GQ session (Authorization) header at all", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/gq/webhooks/channex")
      // Deliberately no Authorization header - only the webhook secret.
      .set("x-channex-webhook-secret", REAL_SECRET)
      .send({ event: "booking_new" });

    expect(res.status).toBe(200);
  });
});

describe("POST /api/gq/webhooks/channex - monitoring writes", () => {
  it("logs an accepted call to gq_webhook_log, keyed on the booking id", async () => {
    const app = createApp();
    await request(app)
      .post("/api/gq/webhooks/channex")
      .set("x-channex-webhook-secret", REAL_SECRET)
      .send({ event: "booking_new", payload: { booking_id: "cx-booking-1" } });
    await flushAsync();

    expect(createWebhookLog).toHaveBeenCalledWith({ event: "booking_new", ref: "cx-booking-1", httpStatusReturned: 200 });
  });

  it("falls back to the event name as ref when there is no booking/revision id", async () => {
    const app = createApp();
    await request(app)
      .post("/api/gq/webhooks/channex")
      .set("x-channex-webhook-secret", REAL_SECRET)
      .send({ event: "sync_error" });
    await flushAsync();

    expect(createWebhookLog).toHaveBeenCalledWith({ event: "sync_error", ref: "sync_error", httpStatusReturned: 200 });
  });

  it("queues an error-queue entry when async revision processing throws", async () => {
    vi.mocked(processRevision).mockRejectedValueOnce(new Error("boom"));

    const app = createApp();
    await request(app)
      .post("/api/gq/webhooks/channex")
      .set("x-channex-webhook-secret", REAL_SECRET)
      .send({ event: "booking_new", payload: { booking_id: "cx-booking-1" } });
    await flushAsync();

    expect(createErrorQueueEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "channex_webhook_async_processing",
        errorMessage: "boom",
        payload: expect.objectContaining({ bookingId: "cx-booking-1" }),
      })
    );
  });
});

describe("POST /api/gq/webhooks/channex - booking-category events with no payload.booking_id", () => {
  it("falls back to pulling the property's revision feed, instead of silently discarding a real booking event", async () => {
    vi.mocked(getChannexRevisionFeed).mockResolvedValue({
      data: [{ attributes: { id: "rev-1" } }, { attributes: { id: "rev-2" } }],
      meta: { total: 2, page: 1, limit: 20 },
    } as never);

    const app = createApp();
    await request(app)
      .post("/api/gq/webhooks/channex")
      .set("x-channex-webhook-secret", REAL_SECRET)
      // Real-world shape confirmed 2026-10-06: booking_new arrived with no payload at
      // all, only the root property_id.
      .send({ event: "booking_new", property_id: "cx-prop-1" });
    await flushAsync();

    expect(getChannexRevisionFeed).toHaveBeenCalledWith("cx-prop-1", 1, 20, expect.any(String));
    expect(processRevision).toHaveBeenCalledTimes(2);
    expect(processRevision).toHaveBeenCalledWith({ id: "rev-1" }, expect.any(String));
    expect(processRevision).toHaveBeenCalledWith({ id: "rev-2" }, expect.any(String));
    expect(createErrorQueueEntry).not.toHaveBeenCalled();
  });

  it("does not fall back for a non-booking event with no payload - stays a no-op as before", async () => {
    const app = createApp();
    await request(app)
      .post("/api/gq/webhooks/channex")
      .set("x-channex-webhook-secret", REAL_SECRET)
      .send({ event: "sync_error", property_id: "cx-prop-1" });
    await flushAsync();

    expect(getChannexRevisionFeed).not.toHaveBeenCalled();
    expect(processRevision).not.toHaveBeenCalled();
  });

  it("queues an error-queue entry when a booking-category event has neither a booking_id nor a property_id to recover with", async () => {
    const app = createApp();
    await request(app)
      .post("/api/gq/webhooks/channex")
      .set("x-channex-webhook-secret", REAL_SECRET)
      .send({ event: "booking" });
    await flushAsync();

    expect(getChannexRevisionFeed).not.toHaveBeenCalled();
    expect(createErrorQueueEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "channex_webhook_async_processing",
        errorMessage: expect.stringContaining("no payload.booking_id and no root property_id"),
      })
    );
  });
});
