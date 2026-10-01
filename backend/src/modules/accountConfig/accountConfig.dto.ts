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
  createdAt: string;
}

export interface AccountConfigCreatedResponseDto extends AccountConfigResponseDto {
  webhookSecret: string;
}

export function toAccountConfigResponseDto(row: gq_account_config): AccountConfigResponseDto {
  return {
    id: row.id,
    bqPropertyId: row.bq_property_id,
    webhookUrl: row.webhook_url,
    environment: row.environment,
    isActive: row.is_active,
    sendData: row.send_data,
    createdAt: row.created_at.toISOString(),
  };
}

export function toAccountConfigCreatedResponseDto(row: gq_account_config): AccountConfigCreatedResponseDto {
  return { ...toAccountConfigResponseDto(row), webhookSecret: row.webhook_secret };
}
