import { gq_channel_mapping } from "@prisma/client";
import { prisma } from "./prismaClient";

export interface UpsertChannelMappingInput {
  channelId: string;
  bqRoomTypeId: number;
  ratePlanId: string;
  otaRoomCode: string;
  otaRateCode: string;
  cxMappingId: string;
}

/** Keyed on cx_mapping_id (unique) - syncing the same Channex known_mapping again updates the cached row rather than duplicating it. */
export async function upsertChannelMapping(input: UpsertChannelMappingInput): Promise<gq_channel_mapping> {
  return prisma.gq_channel_mapping.upsert({
    where: { cx_mapping_id: input.cxMappingId },
    create: {
      channel_id: input.channelId,
      bq_room_type_id: input.bqRoomTypeId,
      rate_plan_id: input.ratePlanId,
      ota_room_code: input.otaRoomCode,
      ota_rate_code: input.otaRateCode,
      cx_mapping_id: input.cxMappingId,
    },
    update: {
      bq_room_type_id: input.bqRoomTypeId,
      rate_plan_id: input.ratePlanId,
      ota_room_code: input.otaRoomCode,
      ota_rate_code: input.otaRateCode,
    },
  });
}

export async function listMappingsForChannel(channelId: string): Promise<gq_channel_mapping[]> {
  return prisma.gq_channel_mapping.findMany({ where: { channel_id: channelId } });
}

export async function findMappingById(id: string): Promise<gq_channel_mapping | null> {
  return prisma.gq_channel_mapping.findUnique({ where: { id } });
}

/** Removes GQ's local cached copy only - Channex has no API to delete the mapping it represents, which still exists on Channex's side (see channel.service.ts). */
export async function deleteMapping(id: string): Promise<void> {
  await prisma.gq_channel_mapping.delete({ where: { id } });
}
