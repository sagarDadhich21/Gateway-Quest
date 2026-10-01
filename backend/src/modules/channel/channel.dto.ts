import { gq_channel, gq_channel_mapping } from "@prisma/client";

export interface ChannelResponseDto {
  id: string;
  propertyId: number;
  title: string;
  channel: string;
  currency: string | null;
  isActive: boolean;
  channex: { channelId: string };
  createdAt: string;
  updatedAt: string;
}

/**
 * Note: earlier versions of this DTO carried a `status` field, assumed from a docs
 * summary that turned out to be wrong - confirmed live against Channex staging that no
 * `status` field exists anywhere in a real channel payload, only `is_active`. Removed
 * rather than left in as always-null dead data.
 */
export function toChannelResponseDto(row: gq_channel): ChannelResponseDto {
  return {
    id: row.id,
    propertyId: row.bq_property_id,
    title: row.title,
    channel: row.channel,
    currency: row.currency,
    isActive: row.is_active,
    channex: { channelId: row.cx_channel_id },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface ChannelMappingResponseDto {
  id: string;
  channelId: string;
  roomTypeId: number;
  ratePlanId: string;
  otaRoomCode: string;
  otaRateCode: string;
  channex: { mappingId: string };
}

export function toChannelMappingResponseDto(row: gq_channel_mapping): ChannelMappingResponseDto {
  return {
    id: row.id,
    channelId: row.channel_id,
    roomTypeId: row.bq_room_type_id,
    ratePlanId: row.rate_plan_id,
    otaRoomCode: row.ota_room_code,
    otaRateCode: row.ota_rate_code,
    channex: { mappingId: row.cx_mapping_id },
  };
}

export interface ConnectionTokenResponseDto {
  token: string;
  iframeUrl: string;
  /** Per Channex's own docs: valid 15 minutes, single-use. */
  expiresInMinutes: number;
}
