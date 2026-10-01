import { describe, expect, it } from "vitest";
import { normalizeBookingDetailResponse, redact } from "./channex.client";
import { ChannexBookingDetailResponse } from "./channex.types";

function detailResponse(attrs: Partial<ChannexBookingDetailResponse["data"]["attributes"]>): ChannexBookingDetailResponse {
  return {
    data: {
      type: "booking_revision",
      id: "placeholder",
      attributes: {
        id: "booking-id-1",
        property_id: "cx-prop-1",
        booking_id: "booking-id-1",
        ota_reservation_code: null,
        status: "new",
        rooms: [],
        amount: "100.00",
        currency: "GBP",
        arrival_date: "2026-10-02",
        departure_date: "2026-10-03",
        inserted_at: "2026-10-01T00:00:00Z",
        ...attrs,
      },
    },
  };
}

describe("redact", () => {
  it("masks known sensitive keys case-insensitively", () => {
    expect(
      redact({ "user-api-key": "secret-abc", "API_KEY": "another-secret", password: "hunter2" })
    ).toEqual({ "user-api-key": "[redacted]", API_KEY: "[redacted]", password: "[redacted]" });
  });

  it("masks sensitive keys nested inside objects and arrays", () => {
    const input = {
      guarantee: { card_number: "4111111111111111", cvv: "123", cardholder_name: "Jane Doe" },
      guests: [{ name: "Jane", token: "abc123" }],
    };

    expect(redact(input)).toEqual({
      guarantee: { card_number: "[redacted]", cvv: "[redacted]", cardholder_name: "Jane Doe" },
      guests: [{ name: "Jane", token: "[redacted]" }],
    });
  });

  it("leaves non-sensitive values untouched", () => {
    const input = { property_id: "cx-prop-1", amount: 4999, currency: "GBP" };
    expect(redact(input)).toEqual(input);
  });

  it("passes through primitives and null/undefined unchanged", () => {
    expect(redact("plain string")).toBe("plain string");
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });
});

describe("normalizeBookingDetailResponse", () => {
  it("replaces attributes.id with revision_id when they differ (GET /bookings/:id's real shape)", () => {
    const input = detailResponse({ id: "booking-id-1", revision_id: "revision-id-1", booking_id: "booking-id-1" });

    const result = normalizeBookingDetailResponse(input);

    expect(result.data.attributes.id).toBe("revision-id-1");
    // booking_id is untouched - processRevision() still needs the real booking id separately.
    expect(result.data.attributes.booking_id).toBe("booking-id-1");
  });

  it("leaves attributes.id alone when revision_id is absent (a revision-feed entry, where id is already correct)", () => {
    const input = detailResponse({ id: "revision-id-1", booking_id: "booking-id-1" });
    delete (input.data.attributes as { revision_id?: string }).revision_id;

    const result = normalizeBookingDetailResponse(input);

    expect(result.data.attributes.id).toBe("revision-id-1");
  });

  it("leaves attributes.id alone when revision_id happens to equal it already", () => {
    const input = detailResponse({ id: "same-id", revision_id: "same-id" });

    const result = normalizeBookingDetailResponse(input);

    expect(result.data.attributes.id).toBe("same-id");
  });
});
