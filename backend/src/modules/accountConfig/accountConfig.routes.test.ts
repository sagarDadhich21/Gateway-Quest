import "dotenv/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("./accountConfig.service", () => ({
  createAccountConfig: vi.fn(),
  listAccountConfigs: vi.fn(),
}));

import { createAccountConfig, listAccountConfigs } from "./accountConfig.service";
import { createApp } from "../../app";

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
      .send({ webhookUrl: "https://example.com/webhooks/channex", apiKey: "k", environment: "production" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ADMIN_ONLY");
    expect(createAccountConfig).not.toHaveBeenCalled();
  });

  it("creates a config for an admin session token and returns the webhook secret", async () => {
    vi.mocked(createAccountConfig).mockResolvedValue({
      id: "cfg-1",
      bqPropertyId: null,
      webhookUrl: "https://example.com/webhooks/channex",
      environment: "production",
      isActive: true,
      sendData: false,
      createdAt: "2026-09-24T00:00:00.000Z",
      webhookSecret: "generated-secret",
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/gq/account-config")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ webhookUrl: "https://example.com/webhooks/channex", apiKey: "k", environment: "production" });

    expect(res.status).toBe(201);
    expect(res.body.webhookSecret).toBe("generated-secret");
  });

  it("422s on an invalid body", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/gq/account-config")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({ webhookUrl: "not-a-url", apiKey: "", environment: "" });

    expect(res.status).toBe(422);
    expect(createAccountConfig).not.toHaveBeenCalled();
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
