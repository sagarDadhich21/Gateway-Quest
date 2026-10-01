import { randomBytes } from "crypto";
import * as accountConfigRepo from "../../repositories/gqAccountConfig.repository";
import { logger } from "../../services/logger";
import {
  AccountConfigCreatedResponseDto,
  AccountConfigResponseDto,
  toAccountConfigCreatedResponseDto,
  toAccountConfigResponseDto,
} from "./accountConfig.dto";
import { CreateAccountConfigInput } from "./accountConfig.schema";

/**
 * The webhook secret is always generated here, never accepted from the request body -
 * that's the only way to guarantee it's actually random rather than whatever a caller
 * happens to type in. It's returned once, on creation, and never again (see
 * AccountConfigResponseDto).
 */
export async function createAccountConfig(
  input: CreateAccountConfigInput,
  correlationId: string
): Promise<AccountConfigCreatedResponseDto> {
  const webhookSecret = randomBytes(32).toString("hex");

  const row = await accountConfigRepo.createAccountConfig({
    bq_property_id: input.bqPropertyId ?? null,
    webhook_url: input.webhookUrl,
    webhook_secret: webhookSecret,
    api_key: input.apiKey,
    environment: input.environment,
    send_data: input.sendData ?? false,
  });

  logger.info("gq_account_config_created", { correlationId, accountConfigId: row.id, bqPropertyId: row.bq_property_id });

  return toAccountConfigCreatedResponseDto(row);
}

export async function listAccountConfigs(): Promise<AccountConfigResponseDto[]> {
  const rows = await accountConfigRepo.listAccountConfigs();
  return rows.map(toAccountConfigResponseDto);
}
