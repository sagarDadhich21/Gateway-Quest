import { gq_channel, gq_channel_mapping } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { toChannelMappingResponseDto, toChannelResponseDto } from "./channel.dto";

describe("toChannelResponseDto", () => {
  it("maps a gq_channel row into the response shape", () => {
    const row: gq_channel = {
      id: "11111111-1111-1111-1111-111111111111",
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
      cx_channel_id: "22222222-2222-2222-2222-222222222222",
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      updated_at: new Date("2026-01-02T00:00:00.000Z"),
    };

    expect(toChannelResponseDto(row)).toEqual({
      id: row.id,
      propertyId: 1,
      title: "Booking.com",
      channel: "booking",
      currency: "INR",
      isActive: true,
      channex: { channelId: row.cx_channel_id },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });
});

describe("toChannelMappingResponseDto", () => {
  it("maps a gq_channel_mapping row into the response shape", () => {
    const row: gq_channel_mapping = {
      id: "33333333-3333-3333-3333-333333333333",
      channel_id: "11111111-1111-1111-1111-111111111111",
      bq_room_type_id: 967,
      rate_plan_id: "44444444-4444-4444-4444-444444444444",
      ota_room_code: "DBL",
      ota_rate_code: "BAR",
      cx_mapping_id: "55555555-5555-5555-5555-555555555555",
    };

    expect(toChannelMappingResponseDto(row)).toEqual({
      id: row.id,
      channelId: row.channel_id,
      roomTypeId: 967,
      ratePlanId: row.rate_plan_id,
      otaRoomCode: "DBL",
      otaRateCode: "BAR",
      channex: { mappingId: row.cx_mapping_id },
    });
  });
});
