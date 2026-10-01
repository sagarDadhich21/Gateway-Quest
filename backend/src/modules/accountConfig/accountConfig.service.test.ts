import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../repositories/gqAccountConfig.repository", () => ({
  createAccountConfig: vi.fn(),
  listAccountConfigs: vi.fn(),
}));

import * as accountConfigRepo from "../../repositories/gqAccountConfig.repository";
import { createAccountConfig, listAccountConfigs } from "./accountConfig.service";

const ROW = {
  id: "cfg-1",
  bq_property_id: 1,
  webhook_url: "https://example.com/webhooks/channex",
  webhook_secret: "should-never-leak-from-list",
  api_key: "cx-api-key",
  environment: "production",
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
  it("generates a random webhook secret and returns it once", async () => {
    vi.mocked(accountConfigRepo.createAccountConfig).mockResolvedValue(ROW as never);

    const result = await createAccountConfig(
      { webhookUrl: "https://example.com/webhooks/channex", apiKey: "cx-api-key", environment: "production" },
      "corr-1"
    );

    expect(accountConfigRepo.createAccountConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        webhook_url: "https://example.com/webhooks/channex",
        api_key: "cx-api-key",
        environment: "production",
        bq_property_id: null,
        send_data: false,
      })
    );
    const [callArg] = vi.mocked(accountConfigRepo.createAccountConfig).mock.calls[0];
    expect(callArg.webhook_secret).toHaveLength(64);
    expect(result.webhookSecret).toBe(ROW.webhook_secret);
  });

  it("two calls generate two different secrets", async () => {
    vi.mocked(accountConfigRepo.createAccountConfig).mockResolvedValue(ROW as never);

    await createAccountConfig({ webhookUrl: "https://a.example.com", apiKey: "k", environment: "production" }, "corr-1");
    await createAccountConfig({ webhookUrl: "https://a.example.com", apiKey: "k", environment: "production" }, "corr-2");

    const [[firstCall], [secondCall]] = vi.mocked(accountConfigRepo.createAccountConfig).mock.calls;
    expect(firstCall.webhook_secret).not.toBe(secondCall.webhook_secret);
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
