import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("./accountConfig.service", () => ({
  createAccountConfig: vi.fn(),
  listAccountConfigs: vi.fn(),
  registerAccountConfigWithChannex: vi.fn(),
  rotateAccountConfigSecret: vi.fn(),
  setAccountConfigActive: vi.fn(),
}));

import {
  createAccountConfig,
  listAccountConfigs,
  registerAccountConfigWithChannex,
  rotateAccountConfigSecret,
  setAccountConfigActive,
} from "./accountConfig.service";
import { createApp } from "../../app";
import { AppError } from "../../errors/AppError";

function signToken(roles: string[]): string {
  return jwt.sign(
    { sub: "00000000-0000-0000-0000-000000000001", bqUserId: 1, propertyId: 1, roles },
    process.env.GQ_JWT_SECRET as string,
    { expiresIn: "1h" }
  );
}

const ADMIN_TOKEN = signToken(["Super_Admin"]);
const NON_ADMIN_TOKEN = signToken(["Staff"]);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/gq/account-config", () => {
  it("rejects a request with no session token", async () => {
    const app = createApp();
    const res = await request(app).post("/api/gq/account-config").send({});

    expect(res.status).toBe(401);
  });

  it("rejects a non-admin session token", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/gq/account-config")
      .set("Authorization", `Bearer ${NON_ADMIN_TOKEN}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ADMIN_ONLY");
    expect(createAccountConfig).not.toHaveBeenCalled();
  });

  it("creates a config for an admin session token and returns the webhook secret - webhookUrl/environment are server-derived, not accepted from the body", async () => {
    vi.mocked(createAccountConfig).mockResolvedValue({
      id: "cfg-1",
      bqPropertyId: null,
      webhookUrl: "https://example.com/webhooks/channex",
      environment: "staging",
      isActive: true,
      sendData: false,
      cxWebhookId: null,
      createdAt: "2026-09-24T00:00:00.000Z",
      webhookSecret: "generated-secret",
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/gq/account-config")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ sendData: true });

    expect(res.status).toBe(201);
    expect(res.body.webhookSecret).toBe("generated-secret");
    expect(res.body).not.toHaveProperty("apiKey");
  });

  it("422s on an invalid body", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/gq/account-config")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ bqPropertyId: -1 });

    expect(res.status).toBe(422);
    expect(createAccountConfig).not.toHaveBeenCalled();
  });

  it("409s with ACCOUNT_CONFIG_SCOPE_TAKEN when the service rejects a duplicate scope", async () => {
    vi.mocked(createAccountConfig).mockRejectedValue(
      new AppError("ACCOUNT_CONFIG_SCOPE_TAKEN", 409, "A config already exists for this property.", {
        existingAccountConfigId: "existing-cfg",
      })
    );

    const app = createApp();
    const res = await request(app)
      .post("/api/gq/account-config")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ bqPropertyId: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ACCOUNT_CONFIG_SCOPE_TAKEN");
  });
});

describe("GET /api/gq/account-config", () => {
  it("rejects a non-admin session token", async () => {
    const app = createApp();
    const res = await request(app).get("/api/gq/account-config").set("Authorization", `Bearer ${NON_ADMIN_TOKEN}`);

    expect(res.status).toBe(403);
  });

  it("lists configs for an admin session token, never including a secret", async () => {
    vi.mocked(listAccountConfigs).mockResolvedValue([
      {
        id: "cfg-1",
        bqPropertyId: 1,
        webhookUrl: "https://example.com/webhooks/channex",
        environment: "production",
        isActive: true,
        sendData: false,
        cxWebhookId: null,
        createdAt: "2026-09-24T00:00:00.000Z",
      },
    ]);

    const app = createApp();
    const res = await request(app).get("/api/gq/account-config").set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.accountConfigs).toHaveLength(1);
    expect(res.body.accountConfigs[0]).not.toHaveProperty("webhookSecret");
  });
});

describe("POST /api/gq/account-config/:accountConfigId/register-with-channex", () => {
  const VALID_ID = "11111111-1111-1111-1111-111111111111";

  it("rejects a non-admin session token", async () => {
    const app = createApp();
    const res = await request(app)
      .post(`/api/gq/account-config/${VALID_ID}/register-with-channex`)
      .set("Authorization", `Bearer ${NON_ADMIN_TOKEN}`);

    expect(res.status).toBe(403);
    expect(registerAccountConfigWithChannex).not.toHaveBeenCalled();
  });

  it("422s on a non-uuid id", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/gq/account-config/not-a-uuid/register-with-channex")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(422);
    expect(registerAccountConfigWithChannex).not.toHaveBeenCalled();
  });

  it("registers with Channex for an admin session token and returns the updated config", async () => {
    vi.mocked(registerAccountConfigWithChannex).mockResolvedValue({
      id: VALID_ID,
      bqPropertyId: 1,
      webhookUrl: "https://example.com/webhooks/channex",
      environment: "production",
      isActive: true,
      sendData: false,
      cxWebhookId: "cx-webhook-1",
      createdAt: "2026-09-24T00:00:00.000Z",
      sharedWithOtherActiveConfigs: 0,
    });

    const app = createApp();
    const res = await request(app)
      .post(`/api/gq/account-config/${VALID_ID}/register-with-channex`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.cxWebhookId).toBe("cx-webhook-1");
    expect(registerAccountConfigWithChannex).toHaveBeenCalledWith(VALID_ID, expect.any(String));
  });

  it("surfaces sharedWithOtherActiveConfigs so the frontend can warn about a stale secret", async () => {
    vi.mocked(registerAccountConfigWithChannex).mockResolvedValue({
      id: VALID_ID,
      bqPropertyId: 1,
      webhookUrl: "https://example.com/webhooks/channex",
      environment: "production",
      isActive: true,
      sendData: false,
      cxWebhookId: "cx-webhook-1",
      createdAt: "2026-09-24T00:00:00.000Z",
      sharedWithOtherActiveConfigs: 2,
    });

    const app = createApp();
    const res = await request(app)
      .post(`/api/gq/account-config/${VALID_ID}/register-with-channex`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.sharedWithOtherActiveConfigs).toBe(2);
  });
});

describe("POST /api/gq/account-config/:accountConfigId/rotate-secret", () => {
  const VALID_ID = "11111111-1111-1111-1111-111111111111";

  it("rejects a non-admin session token", async () => {
    const app = createApp();
    const res = await request(app)
      .post(`/api/gq/account-config/${VALID_ID}/rotate-secret`)
      .set("Authorization", `Bearer ${NON_ADMIN_TOKEN}`);

    expect(res.status).toBe(403);
    expect(rotateAccountConfigSecret).not.toHaveBeenCalled();
  });

  it("422s on a non-uuid id", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/gq/account-config/not-a-uuid/rotate-secret")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(422);
    expect(rotateAccountConfigSecret).not.toHaveBeenCalled();
  });

  it("rotates the secret for an admin session token and returns it once", async () => {
    vi.mocked(rotateAccountConfigSecret).mockResolvedValue({
      id: VALID_ID,
      bqPropertyId: 1,
      webhookUrl: "https://example.com/webhooks/channex",
      environment: "staging",
      isActive: true,
      sendData: false,
      cxWebhookId: "cx-webhook-1",
      createdAt: "2026-09-24T00:00:00.000Z",
      webhookSecret: "rotated-secret",
    });

    const app = createApp();
    const res = await request(app)
      .post(`/api/gq/account-config/${VALID_ID}/rotate-secret`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.webhookSecret).toBe("rotated-secret");
    expect(res.body.id).toBe(VALID_ID);
    expect(rotateAccountConfigSecret).toHaveBeenCalledWith(VALID_ID, expect.any(String));
  });
});

describe("PATCH /api/gq/account-config/:accountConfigId/active", () => {
  const VALID_ID = "11111111-1111-1111-1111-111111111111";

  it("rejects a non-admin session token", async () => {
    const app = createApp();
    const res = await request(app)
      .patch(`/api/gq/account-config/${VALID_ID}/active`)
      .set("Authorization", `Bearer ${NON_ADMIN_TOKEN}`)
      .send({ isActive: false });

    expect(res.status).toBe(403);
    expect(setAccountConfigActive).not.toHaveBeenCalled();
  });

  it("422s on a non-boolean isActive", async () => {
    const app = createApp();
    const res = await request(app)
      .patch(`/api/gq/account-config/${VALID_ID}/active`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ isActive: "nope" });

    expect(res.status).toBe(422);
    expect(setAccountConfigActive).not.toHaveBeenCalled();
  });

  it("deactivates a config for an admin session token", async () => {
    vi.mocked(setAccountConfigActive).mockResolvedValue({
      id: VALID_ID,
      bqPropertyId: 1,
      webhookUrl: "https://example.com/webhooks/channex",
      environment: "production",
      isActive: false,
      sendData: false,
      cxWebhookId: "cx-webhook-1",
      createdAt: "2026-09-24T00:00:00.000Z",
    });

    const app = createApp();
    const res = await request(app)
      .patch(`/api/gq/account-config/${VALID_ID}/active`)
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    expect(setAccountConfigActive).toHaveBeenCalledWith(VALID_ID, false, expect.any(String));
  });
});
