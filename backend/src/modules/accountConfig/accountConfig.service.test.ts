import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../repositories/gqAccountConfig.repository", () => ({
  createAccountConfig: vi.fn(),
  listAccountConfigs: vi.fn(),
  findAccountConfigById: vi.fn(),
  findAccountConfigByScope: vi.fn(),
  setChannexWebhookId: vi.fn(),
  setAccountConfigActive: vi.fn(),
  setWebhookSecret: vi.fn(),
  countOtherActiveConfigsWithWebhookId: vi.fn(),
}));
vi.mock("../../clients/bq/bq.client", () => ({
  getBqProperty: vi.fn(),
}));
vi.mock("../../clients/channex/channex.client", () => ({
  createChannexWebhook: vi.fn(),
  listChannexWebhooks: vi.fn(),
  updateChannexWebhook: vi.fn(),
}));

import { getBqProperty } from "../../clients/bq/bq.client";
import {
  createChannexWebhook,
  listChannexWebhooks,
  updateChannexWebhook,
} from "../../clients/channex/channex.client";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import * as accountConfigRepo from "../../repositories/gqAccountConfig.repository";
import {
  createAccountConfig,
  listAccountConfigs,
  registerAccountConfigWithChannex,
  rotateAccountConfigSecret,
  setAccountConfigActive,
} from "./accountConfig.service";

const EXPECTED_WEBHOOK_URL = `${env.PUBLIC_WEBHOOK_BASE_URL}/api/gq/webhooks/channex`;

const ROW = {
  id: "cfg-1",
  bq_property_id: 1,
  webhook_url: EXPECTED_WEBHOOK_URL,
  webhook_secret: "should-never-leak-from-list",
  environment: env.CHANNEX_ENVIRONMENT,
  cx_webhook_id: null,
  is_active: true,
  send_data: false,
  created_at: new Date("2026-09-24T00:00:00Z"),
  updated_at: new Date("2026-09-24T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createAccountConfig", () => {
  beforeEach(() => {
    vi.mocked(accountConfigRepo.findAccountConfigByScope).mockResolvedValue(null);
  });

  it("derives webhookUrl/environment server-side and generates a random secret, returned once", async () => {
    vi.mocked(accountConfigRepo.createAccountConfig).mockResolvedValue(ROW as never);

    const result = await createAccountConfig({}, "corr-1");

    expect(accountConfigRepo.createAccountConfig).toHaveBeenCalledWith({
      webhook_url: EXPECTED_WEBHOOK_URL,
      environment: env.CHANNEX_ENVIRONMENT,
      bq_property_id: null,
      send_data: false,
      webhook_secret: expect.any(String),
    });
    const [callArg] = vi.mocked(accountConfigRepo.createAccountConfig).mock.calls[0];
    expect(callArg.webhook_secret).toHaveLength(64);
    expect(result.webhookSecret).toBe(ROW.webhook_secret);
  });

  it("two calls generate two different secrets", async () => {
    vi.mocked(accountConfigRepo.createAccountConfig).mockResolvedValue(ROW as never);

    await createAccountConfig({}, "corr-1");
    await createAccountConfig({}, "corr-2");

    const [[firstCall], [secondCall]] = vi.mocked(accountConfigRepo.createAccountConfig).mock.calls;
    expect(firstCall.webhook_secret).not.toBe(secondCall.webhook_secret);
  });

  it("checks for an existing row in this exact scope before creating", async () => {
    vi.mocked(accountConfigRepo.createAccountConfig).mockResolvedValue(ROW as never);

    await createAccountConfig({ bqPropertyId: 42 }, "corr-1");

    expect(accountConfigRepo.findAccountConfigByScope).toHaveBeenCalledWith(42);
  });

  it("throws ACCOUNT_CONFIG_SCOPE_TAKEN instead of creating a duplicate for a scope that already has a row", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigByScope).mockResolvedValue({ ...ROW, id: "existing-cfg" } as never);

    await expect(createAccountConfig({ bqPropertyId: 1 }, "corr-1")).rejects.toMatchObject({
      code: "ACCOUNT_CONFIG_SCOPE_TAKEN",
      details: { existingAccountConfigId: "existing-cfg" },
    });
    expect(accountConfigRepo.createAccountConfig).not.toHaveBeenCalled();
  });
});

describe("rotateAccountConfigSecret", () => {
  it("throws ACCOUNT_CONFIG_NOT_FOUND when the id doesn't exist", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigById).mockResolvedValue(null);

    await expect(rotateAccountConfigSecret("missing-id", "corr-1")).rejects.toMatchObject({
      code: "ACCOUNT_CONFIG_NOT_FOUND",
    });
    expect(accountConfigRepo.setWebhookSecret).not.toHaveBeenCalled();
  });

  it("generates a new secret on the same row and returns it once", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigById).mockResolvedValue(ROW as never);
    vi.mocked(accountConfigRepo.setWebhookSecret).mockResolvedValue({ ...ROW, webhook_secret: "rotated-secret" } as never);

    const result = await rotateAccountConfigSecret("cfg-1", "corr-1");

    const [[, newSecret]] = vi.mocked(accountConfigRepo.setWebhookSecret).mock.calls;
    expect(newSecret).toHaveLength(64);
    expect(newSecret).not.toBe(ROW.webhook_secret);
    expect(result.id).toBe(ROW.id);
    expect(result.webhookSecret).toBe("rotated-secret");
  });
});

describe("listAccountConfigs", () => {
  it("never includes webhook_secret in the mapped response", async () => {
    vi.mocked(accountConfigRepo.listAccountConfigs).mockResolvedValue([ROW] as never);

    const result = await listAccountConfigs();

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("webhookSecret");
    expect(JSON.stringify(result)).not.toContain(ROW.webhook_secret);
  });
});

describe("registerAccountConfigWithChannex", () => {
  beforeEach(() => {
    vi.mocked(accountConfigRepo.setChannexWebhookId).mockResolvedValue({
      ...ROW,
      cx_webhook_id: "cx-webhook-1",
    } as never);
    vi.mocked(createChannexWebhook).mockResolvedValue({ data: { id: "cx-webhook-1", type: "webhook" } });
    vi.mocked(accountConfigRepo.countOtherActiveConfigsWithWebhookId).mockResolvedValue(0);
  });

  it("throws ACCOUNT_CONFIG_NOT_FOUND when the id doesn't exist", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigById).mockResolvedValue(null);

    await expect(registerAccountConfigWithChannex("missing-id", "corr-1")).rejects.toMatchObject({
      code: "ACCOUNT_CONFIG_NOT_FOUND",
    });
    expect(createChannexWebhook).not.toHaveBeenCalled();
  });

  it("registers as a global webhook when bq_property_id is null", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigById).mockResolvedValue({ ...ROW, bq_property_id: null } as never);

    await registerAccountConfigWithChannex("cfg-1", "corr-1");

    expect(getBqProperty).not.toHaveBeenCalled();
    expect(createChannexWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        webhook: expect.objectContaining({
          callback_url: ROW.webhook_url,
          property_id: null,
          is_global: true,
          headers: { "x-channex-webhook-secret": ROW.webhook_secret },
        }),
      }),
      "corr-1"
    );
  });

  it("resolves the real Channex property id and registers as property-scoped when bq_property_id is set", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigById).mockResolvedValue(ROW as never);
    vi.mocked(getBqProperty).mockResolvedValue({ cx_property_id: "cx-prop-1" } as never);

    await registerAccountConfigWithChannex("cfg-1", "corr-1");

    expect(getBqProperty).toHaveBeenCalledWith(1, "corr-1");
    expect(createChannexWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        webhook: expect.objectContaining({ property_id: "cx-prop-1", is_global: false }),
      }),
      "corr-1"
    );
  });

  it("always registers as active on Channex, even when the config is deactivated locally", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigById).mockResolvedValue({ ...ROW, is_active: false } as never);

    await registerAccountConfigWithChannex("cfg-1", "corr-1");

    expect(createChannexWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ webhook: expect.objectContaining({ is_active: true }) }),
      "corr-1"
    );
  });

  it("stores the returned cx_webhook_id and returns it in the response, without leaking the secret", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigById).mockResolvedValue({ ...ROW, bq_property_id: null } as never);

    const result = await registerAccountConfigWithChannex("cfg-1", "corr-1");

    expect(accountConfigRepo.setChannexWebhookId).toHaveBeenCalledWith("cfg-1", "cx-webhook-1");
    expect(result.cxWebhookId).toBe("cx-webhook-1");
    expect(result).not.toHaveProperty("webhookSecret");
  });

  it("updates the existing Channex webhook in place when already registered, rather than creating a second one", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigById).mockResolvedValue({
      ...ROW,
      bq_property_id: null,
      cx_webhook_id: "cx-webhook-1",
    } as never);
    vi.mocked(updateChannexWebhook).mockResolvedValue({ data: { id: "cx-webhook-1", type: "webhook" } });

    await registerAccountConfigWithChannex("cfg-1", "corr-1");

    expect(updateChannexWebhook).toHaveBeenCalledWith(
      "cx-webhook-1",
      expect.objectContaining({ webhook: expect.objectContaining({ callback_url: ROW.webhook_url }) }),
      "corr-1"
    );
    expect(createChannexWebhook).not.toHaveBeenCalled();
    expect(accountConfigRepo.setChannexWebhookId).toHaveBeenCalledWith("cfg-1", "cx-webhook-1");
  });

  it("adopts Channex's existing webhook via PUT when create conflicts on (callback_url, event_mask)", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigById).mockResolvedValue({ ...ROW, bq_property_id: null } as never);
    vi.mocked(createChannexWebhook).mockRejectedValue(
      new AppError("CHANNEX_UPSTREAM_ERROR", 422, "Channex rejected the request.", {
        channexErrors: {
          code: "validation_error",
          title: "Validation Error",
          details: { billing_account_id: ["only one webhook for callback url and event mask allowed"] },
        },
      })
    );
    vi.mocked(listChannexWebhooks).mockResolvedValue({
      data: [
        {
          id: "cx-webhook-existing",
          type: "webhook",
          attributes: { callback_url: ROW.webhook_url, event_mask: "*" },
        },
      ],
    });
    vi.mocked(updateChannexWebhook).mockResolvedValue({ data: { id: "cx-webhook-existing", type: "webhook" } });

    const result = await registerAccountConfigWithChannex("cfg-1", "corr-1");

    expect(updateChannexWebhook).toHaveBeenCalledWith(
      "cx-webhook-existing",
      expect.objectContaining({ webhook: expect.objectContaining({ callback_url: ROW.webhook_url }) }),
      "corr-1"
    );
    expect(accountConfigRepo.setChannexWebhookId).toHaveBeenCalledWith("cfg-1", "cx-webhook-existing");
    expect(result.cxWebhookId).toBe("cx-webhook-1");
  });

  it("re-throws a create conflict as-is when no matching webhook is found in the list", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigById).mockResolvedValue({ ...ROW, bq_property_id: null } as never);
    const conflict = new AppError("CHANNEX_UPSTREAM_ERROR", 422, "Channex rejected the request.", {
      channexErrors: {
        details: { billing_account_id: ["only one webhook for callback url and event mask allowed"] },
      },
    });
    vi.mocked(createChannexWebhook).mockRejectedValue(conflict);
    vi.mocked(listChannexWebhooks).mockResolvedValue({ data: [] });

    await expect(registerAccountConfigWithChannex("cfg-1", "corr-1")).rejects.toBe(conflict);
    expect(updateChannexWebhook).not.toHaveBeenCalled();
  });

  it("falls back to create-or-adopt when the stored cx_webhook_id is stale (404 from Channex)", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigById).mockResolvedValue({
      ...ROW,
      bq_property_id: null,
      cx_webhook_id: "cx-webhook-stale",
    } as never);
    vi.mocked(updateChannexWebhook).mockRejectedValue(
      new AppError("CHANNEX_UPSTREAM_ERROR", 404, "Channex rejected the request.")
    );
    vi.mocked(createChannexWebhook).mockResolvedValue({ data: { id: "cx-webhook-new", type: "webhook" } });

    await registerAccountConfigWithChannex("cfg-1", "corr-1");

    expect(updateChannexWebhook).toHaveBeenCalledWith("cx-webhook-stale", expect.anything(), "corr-1");
    expect(createChannexWebhook).toHaveBeenCalled();
    expect(accountConfigRepo.setChannexWebhookId).toHaveBeenCalledWith("cfg-1", "cx-webhook-new");
  });

  it("reports how many other active configs share the same Channex webhook", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigById).mockResolvedValue({ ...ROW, bq_property_id: null } as never);
    vi.mocked(accountConfigRepo.countOtherActiveConfigsWithWebhookId).mockResolvedValue(2);

    const result = await registerAccountConfigWithChannex("cfg-1", "corr-1");

    expect(accountConfigRepo.countOtherActiveConfigsWithWebhookId).toHaveBeenCalledWith("cx-webhook-1", "cfg-1");
    expect(result.sharedWithOtherActiveConfigs).toBe(2);
  });
});

describe("setAccountConfigActive", () => {
  it("throws ACCOUNT_CONFIG_NOT_FOUND when the id doesn't exist", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigById).mockResolvedValue(null);

    await expect(setAccountConfigActive("missing-id", false, "corr-1")).rejects.toMatchObject({
      code: "ACCOUNT_CONFIG_NOT_FOUND",
    });
    expect(accountConfigRepo.setAccountConfigActive).not.toHaveBeenCalled();
  });

  it("deactivates a config without touching Channex", async () => {
    vi.mocked(accountConfigRepo.findAccountConfigById).mockResolvedValue(ROW as never);
    vi.mocked(accountConfigRepo.setAccountConfigActive).mockResolvedValue({ ...ROW, is_active: false } as never);

    const result = await setAccountConfigActive("cfg-1", false, "corr-1");

    expect(accountConfigRepo.setAccountConfigActive).toHaveBeenCalledWith("cfg-1", false);
    expect(createChannexWebhook).not.toHaveBeenCalled();
    expect(updateChannexWebhook).not.toHaveBeenCalled();
    expect(result.isActive).toBe(false);
  });
});
