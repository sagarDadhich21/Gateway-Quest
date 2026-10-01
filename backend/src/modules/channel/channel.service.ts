import { getBqProperty, getBqRoomTypes } from "../../clients/bq/bq.client";
import {
  activateChannexChannel,
  createChannexOneTimeToken,
  deactivateChannexChannel,
  getChannexChannel,
  listChannexChannels,
} from "../../clients/channex/channex.client";
import { env } from "../../config/env";
import { channelNotFoundError, propertyNotOnboardedError } from "../../errors/AppError";
import * as channelRepo from "../../repositories/gqChannel.repository";
import * as channelMappingRepo from "../../repositories/gqChannelMapping.repository";
import * as ratePlanRepo from "../../repositories/gqRatePlan.repository";
import { logger } from "../../services/logger";
import { AuthenticatedGqUser } from "../../types/express";
import { assertUserOwnsProperty } from "../property/property.service";
import {
  ChannelMappingResponseDto,
  ChannelResponseDto,
  ConnectionTokenResponseDto,
  toChannelMappingResponseDto,
  toChannelResponseDto,
} from "./channel.dto";

/** Channex's IFrame/mapping screen lives on the app host, not the /api/v1 host the rest of this client talks to. */
function channexAppBaseUrl(): string {
  return env.CHANNEX_BASE_URL.replace(/\/api\/v1\/?$/, "");
}

async function requireOnboardedProperty(propertyId: number, correlationId: string) {
  const bqProperty = await getBqProperty(propertyId, correlationId);
  if (!bqProperty.cx_property_id) {
    throw propertyNotOnboardedError();
  }
  return { ...bqProperty, cx_property_id: bqProperty.cx_property_id };
}

/** Loads a GQ channel row and confirms the caller owns the property it belongs to. */
async function requireOwnedChannel(user: AuthenticatedGqUser, channelId: string) {
  const row = await channelRepo.findChannelById(channelId);
  if (!row) {
    throw channelNotFoundError();
  }
  assertUserOwnsProperty(user, row.bq_property_id);
  return row;
}

/**
 * Lists a property's connected channels, syncing each one into GQ's local gq_channel
 * cache (upsert by cx_channel_id) so channel-scoped routes have a local id to key off.
 */
export async function listChannels(
  user: AuthenticatedGqUser,
  propertyId: number,
  correlationId: string
): Promise<ChannelResponseDto[]> {
  assertUserOwnsProperty(user, propertyId);
  const bqProperty = await requireOnboardedProperty(propertyId, correlationId);

  const channexList = await listChannexChannels(bqProperty.cx_property_id, correlationId);

  return Promise.all(
    channexList.data.map(async (c) => {
      const row = await channelRepo.upsertChannel({
        bqPropertyId: propertyId,
        cxChannelId: c.id,
        title: c.attributes.title,
        channel: c.attributes.channel,
        currency: c.attributes.currency,
        isActive: c.attributes.is_active,
      });
      return toChannelResponseDto(row);
    })
  );
}

/**
 * Generates a Channex one-time token and the IFrame URL it unlocks
 * (docs.channex.io/api-v.1-documentation/channel-iframe) - the only way to configure a
 * new channel connection or its room/rate mappings, since Channex has no REST API for
 * either. GQ hands the frontend this URL to embed in an <iframe>; Channex's own UI
 * takes over from there.
 */
export async function generateConnectionToken(
  user: AuthenticatedGqUser,
  propertyId: number,
  username: string | undefined,
  correlationId: string
): Promise<ConnectionTokenResponseDto> {
  assertUserOwnsProperty(user, propertyId);
  const bqProperty = await requireOnboardedProperty(propertyId, correlationId);

  const response = await createChannexOneTimeToken(
    { property_id: bqProperty.cx_property_id, username: username ?? `gq-user-${user.bqUserId}` },
    correlationId
  );
  const token = response.data.token;

  const iframeUrl =
    `${channexAppBaseUrl()}/auth/exchange?oauth_session_key=${encodeURIComponent(token)}` +
    `&app_mode=headless&redirect_to=/channels&property_id=${encodeURIComponent(bqProperty.cx_property_id)}`;

  logger.info("channex_one_time_token_issued", { correlationId, propertyId });

  return { token, iframeUrl, expiresInMinutes: 15 };
}

export async function getChannelDetails(
  user: AuthenticatedGqUser,
  channelId: string,
  correlationId: string
): Promise<ChannelResponseDto> {
  const row = await requireOwnedChannel(user, channelId);
  const detail = await getChannexChannel(row.cx_channel_id, correlationId);
  const updated = await channelRepo.upsertChannel({
    bqPropertyId: row.bq_property_id,
    cxChannelId: row.cx_channel_id,
    title: detail.data.attributes.title,
    channel: detail.data.attributes.channel,
    currency: detail.data.attributes.currency,
    isActive: detail.data.attributes.is_active,
  });
  return toChannelResponseDto(updated);
}

/**
 * Channex's activate/deactivate endpoints confirm success but return no resource
 * (see ChannexChannelActionResponse's doc comment) - GQ's local is_active is set to the
 * outcome it just asked for and knows succeeded (an error would have thrown before this
 * line), not read back from a body that doesn't carry it.
 */
export async function activateChannel(
  user: AuthenticatedGqUser,
  channelId: string,
  correlationId: string
): Promise<ChannelResponseDto> {
  const row = await requireOwnedChannel(user, channelId);
  await activateChannexChannel(row.cx_channel_id, correlationId);
  const updated = await channelRepo.setChannelActive(row.id, true);
  logger.info("channex_channel_activated", { correlationId, channelId });
  return toChannelResponseDto(updated);
}

export async function deactivateChannel(
  user: AuthenticatedGqUser,
  channelId: string,
  correlationId: string
): Promise<ChannelResponseDto> {
  const row = await requireOwnedChannel(user, channelId);
  await deactivateChannexChannel(row.cx_channel_id, correlationId);
  const updated = await channelRepo.setChannelActive(row.id, false);
  logger.info("channex_channel_deactivated", { correlationId, channelId });
  return toChannelResponseDto(updated);
}

/**
 * Reads current room/rate mappings from Channex and syncs them into
 * gq_channel_mapping - this doubles as both "list" and "create/update" for mappings,
 * since Channex has no separate write API for them.
 *
 * Source of truth: `attributes.settings.mappingSettings.rooms` (OTA room code -> GQ
 * room_type_id) joined with `attributes.rate_plans` (each entry carries its own OTA
 * room/rate codes plus the resolved rate_plan_id) - NOT
 * `relationships.known_mappings`, which is a real field but confirmed empty on a
 * channel that genuinely has working mappings (2026-09-28, see channex.types.ts's doc
 * comment on ChannexChannelAttributes) - the mapping screen's "resync" was silently
 * returning nothing for every channel because of this.
 *
 * A rate_plans entry is only synced when GQ can resolve BOTH its room_type_id (via the
 * mappingSettings join) and rate_plan_id back to an onboarded BQ room type / GQ rate
 * plan on this same property - anything Channex reports that GQ doesn't recognize (a
 * different property, an unmapped/removed room type) is skipped rather than guessed
 * at, satisfying "do not allow mappings for non-onboarded room types/rate plans" and
 * "validate same property" by construction.
 */
export async function listAndSyncMappings(
  user: AuthenticatedGqUser,
  channelId: string,
  correlationId: string
): Promise<ChannelMappingResponseDto[]> {
  const channelRow = await requireOwnedChannel(user, channelId);

  const detail = await getChannexChannel(channelRow.cx_channel_id, correlationId);
  const roomCodeToCxRoomTypeId = detail.data.attributes.settings?.mappingSettings?.rooms ?? {};
  const ratePlanEntries = detail.data.attributes.rate_plans ?? [];

  if (ratePlanEntries.length === 0) {
    return [];
  }

  const [allRoomTypes, ratePlans] = await Promise.all([
    getBqRoomTypes(correlationId),
    ratePlanRepo.listRatePlans({ bqPropertyId: channelRow.bq_property_id }),
  ]);
  const propertyRoomTypes = allRoomTypes.filter((rt) => rt.propertyid === channelRow.bq_property_id);

  const synced: ChannelMappingResponseDto[] = [];

  for (const entry of ratePlanEntries) {
    const otaRoomCode = String(entry.settings.room_type_code);
    const otaRateCode = String(entry.settings.rate_plan_code);
    const cxRoomTypeId = roomCodeToCxRoomTypeId[otaRoomCode];
    const cxRatePlanId = entry.rate_plan_id;

    if (!cxRoomTypeId || !cxRatePlanId) {
      continue; // this OTA room code was never actually mapped to a room type in Channex's mapping screen
    }

    const bqRoomType = propertyRoomTypes.find((rt) => rt.cx_room_type_id === cxRoomTypeId);
    const ratePlan = ratePlans.find((rp) => rp.cx_rate_plan_id === cxRatePlanId);
    if (!bqRoomType || !ratePlan) {
      logger.warn("channex_mapping_unresolved", {
        correlationId,
        channelId,
        cxRoomTypeId,
        cxRatePlanId,
      });
      continue;
    }

    const row = await channelMappingRepo.upsertChannelMapping({
      channelId: channelRow.id,
      bqRoomTypeId: bqRoomType.roomtypeid,
      ratePlanId: ratePlan.id,
      otaRoomCode,
      otaRateCode,
      cxMappingId: entry.id,
    });
    synced.push(toChannelMappingResponseDto(row));
  }

  return synced;
}

/**
 * Removes GQ's local cached copy of a mapping only. Channex has no API to delete a
 * room/rate mapping - the mapping itself still exists on Channex's side until a
 * property owner removes it through the IFrame mapping screen; the next sync
 * (listAndSyncMappings) will simply recreate this row if it's still there.
 */
export async function deleteLocalMapping(user: AuthenticatedGqUser, channelId: string, mappingId: string): Promise<void> {
  const channelRow = await requireOwnedChannel(user, channelId);
  const mapping = await channelMappingRepo.findMappingById(mappingId);
  if (!mapping || mapping.channel_id !== channelRow.id) {
    throw channelNotFoundError();
  }
  await channelMappingRepo.deleteMapping(mappingId);
}
