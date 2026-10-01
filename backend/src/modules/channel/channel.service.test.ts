import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedGqUser } from "../../types/express";

vi.mock("../../clients/bq/bq.client", () => ({
  getBqProperty: vi.fn(),
  getBqRoomTypes: vi.fn(),
}));
vi.mock("../../clients/channex/channex.client", () => ({
  listChannexChannels: vi.fn(),
  getChannexChannel: vi.fn(),
  activateChannexChannel: vi.fn(),
  deactivateChannexChannel: vi.fn(),
  createChannexOneTimeToken: vi.fn(),
}));
vi.mock("../../repositories/gqChannel.repository", () => ({
  upsertChannel: vi.fn(),
  findChannelById: vi.fn(),
  findChannelByCxId: vi.fn(),
  findChannelsByProperty: vi.fn(),
  setChannelActive: vi.fn(),
}));
vi.mock("../../repositories/gqChannelMapping.repository", () => ({
  upsertChannelMapping: vi.fn(),
  listMappingsForChannel: vi.fn(),
  findMappingById: vi.fn(),
  deleteMapping: vi.fn(),
}));
vi.mock("../../repositories/gqRatePlan.repository", () => ({
  listRatePlans: vi.fn(),
}));

import { getBqRoomTypes } from "../../clients/bq/bq.client";
import { getChannexChannel } from "../../clients/channex/channex.client";
import * as channelRepo from "../../repositories/gqChannel.repository";
import * as channelMappingRepo from "../../repositories/gqChannelMapping.repository";
import * as ratePlanRepo from "../../repositories/gqRatePlan.repository";
import { deleteLocalMapping, listAndSyncMappings } from "./channel.service";

const USER: AuthenticatedGqUser = { id: "u1", bqUserId: 1, propertyId: 1, roles: [] };

const CHANNEL_ROW = {
  id: "c0000000-0000-0000-0000-000000000001",
  bq_property_id: 1,
  title: "Booking.com",
  channel: "booking",
  currency: "INR",
  group_id: null,
  is_active: true,
  state: null,
  hotel_id: null,
  pricing_type: "standard",
  send_booking_email: false,
  cx_channel_id: "cx-channel-1",
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  updated_at: new Date("2026-01-01T00:00:00.000Z"),
};

interface FakeRatePlanEntry {
  id: string;
  roomTypeCode: string;
  rateCode: string;
  ratePlanId: string;
}

// Matches the REAL confirmed-live channel detail shape (2026-09-28) -
// attributes.settings.mappingSettings.rooms joined with attributes.rate_plans, NOT
// relationships.known_mappings (a real field, confirmed empty on a channel that
// genuinely has working mappings - see channel.service.ts's doc comment).
function channelDetailWith(rooms: Record<string, string>, ratePlans: FakeRatePlanEntry[]) {
  return {
    data: {
      type: "channel" as const,
      id: CHANNEL_ROW.cx_channel_id,
      attributes: {
        title: "Booking.com",
        channel: "booking",
        currency: "INR",
        is_active: true,
        properties: [],
        settings: { mappingSettings: { rooms } },
        rate_plans: ratePlans.map((rp) => ({
          id: rp.id,
          settings: { room_type_code: rp.roomTypeCode, rate_plan_code: rp.rateCode },
          rate_plan_id: rp.ratePlanId,
        })),
      },
      relationships: { known_mappings: { data: [] } },
    },
  };
}

function bqRoomType(overrides: Partial<{ roomtypeid: number; propertyid: number; cx_room_type_id: string | null }>) {
  return {
    roomtypeid: 967,
    propertyid: 1,
    roomtypename: "Double",
    description: null,
    baseprice: "0",
    max_occupancy: 2,
    deposit_amount: "0",
    is_refundable: false,
    image_urls: [],
    amenities: [],
    service_categories: [],
    cx_room_type_id: "cx-rt-1",
    ...overrides,
  };
}

function gqRatePlan(overrides: Partial<{ id: string; bq_property_id: number; cx_rate_plan_id: string | null }>) {
  return { id: "gq-rp-1", bq_property_id: 1, cx_rate_plan_id: "cx-rp-1", ...overrides } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAndSyncMappings", () => {
  it("throws CHANNEL_NOT_FOUND when the channel doesn't exist", async () => {
    vi.mocked(channelRepo.findChannelById).mockResolvedValue(null);

    await expect(listAndSyncMappings(USER, CHANNEL_ROW.id, "corr-1")).rejects.toMatchObject({
      code: "CHANNEL_NOT_FOUND",
    });
  });

  it("throws FORBIDDEN_PROPERTY_ACCESS when the caller doesn't own the channel's property", async () => {
    vi.mocked(channelRepo.findChannelById).mockResolvedValue({ ...CHANNEL_ROW, bq_property_id: 999 } as never);

    await expect(listAndSyncMappings(USER, CHANNEL_ROW.id, "corr-1")).rejects.toMatchObject({
      code: "FORBIDDEN_PROPERTY_ACCESS",
    });
  });

  it("returns [] and syncs nothing when Channex reports no rate_plans entries", async () => {
    vi.mocked(channelRepo.findChannelById).mockResolvedValue(CHANNEL_ROW as never);
    vi.mocked(getChannexChannel).mockResolvedValue(channelDetailWith({}, []) as never);

    const result = await listAndSyncMappings(USER, CHANNEL_ROW.id, "corr-1");

    expect(result).toEqual([]);
    expect(channelMappingRepo.upsertChannelMapping).not.toHaveBeenCalled();
  });

  it("skips a rate_plans entry whose room code isn't in mappingSettings.rooms (room side never mapped) rather than guessing at it", async () => {
    vi.mocked(channelRepo.findChannelById).mockResolvedValue(CHANNEL_ROW as never);
    vi.mocked(getChannexChannel).mockResolvedValue(
      channelDetailWith({}, [{ id: "km-1", roomTypeCode: "DBL", rateCode: "BAR", ratePlanId: "cx-rp-1" }]) as never
    );
    vi.mocked(getBqRoomTypes).mockResolvedValue([]);
    vi.mocked(ratePlanRepo.listRatePlans).mockResolvedValue([]);

    const result = await listAndSyncMappings(USER, CHANNEL_ROW.id, "corr-1");

    expect(result).toEqual([]);
    expect(channelMappingRepo.upsertChannelMapping).not.toHaveBeenCalled();
  });

  it("skips a mapping whose room type belongs to a different property (same-property validation)", async () => {
    vi.mocked(channelRepo.findChannelById).mockResolvedValue(CHANNEL_ROW as never);
    vi.mocked(getChannexChannel).mockResolvedValue(
      channelDetailWith({ DBL: "cx-rt-1" }, [{ id: "km-1", roomTypeCode: "DBL", rateCode: "BAR", ratePlanId: "cx-rp-1" }]) as never
    );
    vi.mocked(getBqRoomTypes).mockResolvedValue([bqRoomType({ propertyid: 999 })] as never);
    vi.mocked(ratePlanRepo.listRatePlans).mockResolvedValue([gqRatePlan({})] as never);

    const result = await listAndSyncMappings(USER, CHANNEL_ROW.id, "corr-1");

    expect(result).toEqual([]);
    expect(channelMappingRepo.upsertChannelMapping).not.toHaveBeenCalled();
  });

  it("skips a mapping whose room type isn't onboarded to Channex on GQ's side (no cx_room_type_id match)", async () => {
    vi.mocked(channelRepo.findChannelById).mockResolvedValue(CHANNEL_ROW as never);
    vi.mocked(getChannexChannel).mockResolvedValue(
      channelDetailWith({ DBL: "cx-rt-unknown" }, [{ id: "km-1", roomTypeCode: "DBL", rateCode: "BAR", ratePlanId: "cx-rp-1" }]) as never
    );
    vi.mocked(getBqRoomTypes).mockResolvedValue([bqRoomType({})] as never); // cx_room_type_id: "cx-rt-1", not "cx-rt-unknown"
    vi.mocked(ratePlanRepo.listRatePlans).mockResolvedValue([gqRatePlan({})] as never);

    const result = await listAndSyncMappings(USER, CHANNEL_ROW.id, "corr-1");

    expect(result).toEqual([]);
    expect(channelMappingRepo.upsertChannelMapping).not.toHaveBeenCalled();
  });

  it("syncs a fully-resolvable mapping into gq_channel_mapping and returns it", async () => {
    vi.mocked(channelRepo.findChannelById).mockResolvedValue(CHANNEL_ROW as never);
    vi.mocked(getChannexChannel).mockResolvedValue(
      channelDetailWith({ DBL: "cx-rt-1" }, [{ id: "km-1", roomTypeCode: "DBL", rateCode: "BAR", ratePlanId: "cx-rp-1" }]) as never
    );
    vi.mocked(getBqRoomTypes).mockResolvedValue([bqRoomType({})] as never);
    vi.mocked(ratePlanRepo.listRatePlans).mockResolvedValue([gqRatePlan({})] as never);
    vi.mocked(channelMappingRepo.upsertChannelMapping).mockResolvedValue({
      id: "mapping-1",
      channel_id: CHANNEL_ROW.id,
      bq_room_type_id: 967,
      rate_plan_id: "gq-rp-1",
      ota_room_code: "DBL",
      ota_rate_code: "BAR",
      cx_mapping_id: "km-1",
    } as never);

    const result = await listAndSyncMappings(USER, CHANNEL_ROW.id, "corr-1");

    expect(channelMappingRepo.upsertChannelMapping).toHaveBeenCalledWith({
      channelId: CHANNEL_ROW.id,
      bqRoomTypeId: 967,
      ratePlanId: "gq-rp-1",
      otaRoomCode: "DBL",
      otaRateCode: "BAR",
      cxMappingId: "km-1",
    });
    expect(result).toEqual([
      {
        id: "mapping-1",
        channelId: CHANNEL_ROW.id,
        roomTypeId: 967,
        ratePlanId: "gq-rp-1",
        otaRoomCode: "DBL",
        otaRateCode: "BAR",
        channex: { mappingId: "km-1" },
      },
    ]);
  });
});

describe("deleteLocalMapping", () => {
  it("throws CHANNEL_NOT_FOUND when the mapping doesn't belong to this channel", async () => {
    vi.mocked(channelRepo.findChannelById).mockResolvedValue(CHANNEL_ROW as never);
    vi.mocked(channelMappingRepo.findMappingById).mockResolvedValue({
      id: "mapping-1",
      channel_id: "some-other-channel",
      bq_room_type_id: 967,
      rate_plan_id: "gq-rp-1",
      ota_room_code: "DBL",
      ota_rate_code: "BAR",
      cx_mapping_id: "km-1",
    } as never);

    await expect(deleteLocalMapping(USER, CHANNEL_ROW.id, "mapping-1")).rejects.toMatchObject({
      code: "CHANNEL_NOT_FOUND",
    });
    expect(channelMappingRepo.deleteMapping).not.toHaveBeenCalled();
  });

  it("deletes the local row when it belongs to this channel", async () => {
    vi.mocked(channelRepo.findChannelById).mockResolvedValue(CHANNEL_ROW as never);
    vi.mocked(channelMappingRepo.findMappingById).mockResolvedValue({
      id: "mapping-1",
      channel_id: CHANNEL_ROW.id,
      bq_room_type_id: 967,
      rate_plan_id: "gq-rp-1",
      ota_room_code: "DBL",
      ota_rate_code: "BAR",
      cx_mapping_id: "km-1",
    } as never);

    await deleteLocalMapping(USER, CHANNEL_ROW.id, "mapping-1");

    expect(channelMappingRepo.deleteMapping).toHaveBeenCalledWith("mapping-1");
  });
});
