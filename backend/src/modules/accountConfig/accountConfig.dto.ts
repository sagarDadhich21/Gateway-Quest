import { gq_account_config } from "@prisma/client";

/**
 * `webhook_secret` is deliberately never included here - once created it's only ever
 * returned once, in AccountConfigCreatedResponseDto, at creation time. Every other read
 * (list) is redacted so the secret can't leak back out through a route that logs/caches
 * responses.
 */
export interface AccountConfigResponseDto {
  id: string;
  bqPropertyId: number | null;
  webhookUrl: string;
  environment: string;
  isActive: boolean;
  sendData: boolean;
  /** Set once registerAccountConfigWithChannex() has actually registered this with Channex - null until then. */
  cxWebhookId: string | null;
  createdAt: string;
}

/**
 * Returned by both createAccountConfig() and rotateAccountConfigSecret() - either way,
 * a brand new secret was just generated and this is the only time it's ever shown.
 */
export interface AccountConfigCreatedResponseDto extends AccountConfigResponseDto {
  webhookSecret: string;
}

/**
 * Channex allows only one webhook per (callback_url, event_mask) pair, so when several
 * gq_account_config rows share a URL, registering any of them adopts the same Channex
 * webhook - and since Channex only stores one secret per webhook, the most recently
 * registered row's secret is the only one actually live. sharedWithOtherActiveConfigs
 * tells the frontend when that's the case, so it can warn rather than silently showing
 * every row as "Registered".
 */
export interface RegisterAccountConfigResponseDto extends AccountConfigResponseDto {
  sharedWithOtherActiveConfigs: number;
}

export function toAccountConfigResponseDto(row: gq_account_config): AccountConfigResponseDto {
  return {
    id: row.id,
    bqPropertyId: row.bq_property_id,
    webhookUrl: row.webhook_url,
    environment: row.environment,
    isActive: row.is_active,
    sendData: row.send_data,
    cxWebhookId: row.cx_webhook_id,
    createdAt: row.created_at.toISOString(),
  };
}

export function toAccountConfigCreatedResponseDto(row: gq_account_config): AccountConfigCreatedResponseDto {
  return { ...toAccountConfigResponseDto(row), webhookSecret: row.webhook_secret };
}

export function toRegisterAccountConfigResponseDto(
  row: gq_account_config,
  sharedWithOtherActiveConfigs: number
): RegisterAccountConfigResponseDto {
  return { ...toAccountConfigResponseDto(row), sharedWithOtherActiveConfigs };
}
