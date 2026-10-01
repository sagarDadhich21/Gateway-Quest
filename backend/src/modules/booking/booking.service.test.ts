import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannexBookingRevisionAttributes } from "../../clients/channex/channex.types";

vi.mock("../../clients/bq/bq.client", () => ({
  listBqProperties: vi.fn(),
  getBqRoomTypes: vi.fn(),
  createBqBooking: vi.fn(),
  findBqBookingById: vi.fn(),
  cancelBqBooking: vi.fn(),
  modifyBqBooking: vi.fn(),
}));
vi.mock("../../clients/channex/channex.client", () => ({
  ackChannexRevision: vi.fn(),
}));
vi.mock("../../repositories/gqRatePlan.repository", () => ({
  findRatePlanByCxId: vi.fn(),
}));
vi.mock("../../repositories/gqOtaBooking.repository", () => ({
  upsertOtaBooking: vi.fn(),
  findOtaBookingByCxId: vi.fn(),
  setBqBookingRef: vi.fn(),
  setOtaBookingStatus: vi.fn(),
  listOtaBookingsByProperty: vi.fn(),
  findOtaBookingById: vi.fn(),
}));
vi.mock("../../repositories/gqOtaBookingRevision.repository", () => ({
  findRevisionByCxId: vi.fn(),
  createOtaBookingRevision: vi.fn(),
  incrementProcessingAttempts: vi.fn(),
  markRevisionAcked: vi.fn(),
  listUnackedRevisions: vi.fn(),
  listRevisionsByBookingId: vi.fn(),
  listRevisionsByProperty: vi.fn(),
  findRevisionById: vi.fn(),
}));

import { cancelBqBooking, createBqBooking, findBqBookingById, getBqRoomTypes, listBqProperties, modifyBqBooking } from "../../clients/bq/bq.client";
import { ackChannexRevision } from "../../clients/channex/channex.client";
import * as ratePlanRepo from "../../repositories/gqRatePlan.repository";
import * as otaBookingRepo from "../../repositories/gqOtaBooking.repository";
import * as revisionRepo from "../../repositories/gqOtaBookingRevision.repository";
import {
  getBookingForProperty,
  getBookingRevisionForProperty,
  listBookingRevisionsForProperty,
  listBookingsForProperty,
  processRevision,
} from "./booking.service";

const BQ_PROPERTY = { propertyid: 1, cx_property_id: "cx-prop-1" } as never;

const BQ_ROOM_TYPE = {
  roomtypeid: 967,
  propertyid: 1,
  roomtypename: "Double",
  cx_room_type_id: "cx-rt-1",
} as never;

const GQ_RATE_PLAN = { id: "gq-rp-1", bq_property_id: 1, bq_room_type_id: 967, cx_rate_plan_id: "cx-rp-1" } as never;

const OTA_BOOKING_NEW = {
  id: "ota-booking-1",
  bq_property_id: 1,
  bq_orderid: null,
  bq_bookingid: null,
  cx_booking_id: "cx-booking-1",
};

const REVISION_ROW = {
  id: "revision-row-1",
  ota_booking_id: "ota-booking-1",
  cx_revision_id: "rev-1",
  processing_attempts: 0,
  ack_status: "pending",
};

// id is the revision's real, only identifier on the live API - there is no separate
// "revision_id" field (see the doc comment on ChannexBookingRevisionAttributes).
// amount is a numeric string on the real API, not a number.
function makeRevision(overrides: Partial<ChannexBookingRevisionAttributes> = {}): ChannexBookingRevisionAttributes {
  return {
    id: "rev-1",
    property_id: "cx-prop-1",
    booking_id: "cx-booking-1",
    ota_reservation_code: "OTA-123",
    status: "new",
    rooms: [
      {
        room_type_id: "cx-rt-1",
        rate_plan_id: "cx-rp-1",
        checkin_date: "2026-10-01",
        checkout_date: "2026-10-03",
        amount: "5000",
        occupancy: { adults: 2 },
      },
    ],
    // name/surname separate, matching the real live API shape - not a combined "full name" string.
    customer: { name: "Jane", surname: "Doe", mail: "jane@example.com" },
    amount: "5000",
    currency: "INR",
    arrival_date: "2026-10-01",
    departure_date: "2026-10-03",
    inserted_at: "2026-09-24T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listBqProperties).mockResolvedValue([BQ_PROPERTY]);
  vi.mocked(getBqRoomTypes).mockResolvedValue([BQ_ROOM_TYPE]);
  vi.mocked(ratePlanRepo.findRatePlanByCxId).mockResolvedValue(GQ_RATE_PLAN);
  vi.mocked(otaBookingRepo.upsertOtaBooking).mockResolvedValue(OTA_BOOKING_NEW as never);
  vi.mocked(revisionRepo.findRevisionByCxId).mockResolvedValue(null);
  vi.mocked(revisionRepo.createOtaBookingRevision).mockResolvedValue(REVISION_ROW as never);
});

describe("processRevision - idempotency", () => {
  it("skips an already-acked revision without touching BQ or Channex", async () => {
    vi.mocked(revisionRepo.findRevisionByCxId).mockResolvedValue({ ...REVISION_ROW, ack_status: "acked" } as never);

    const result = await processRevision(makeRevision(), "corr-1");

    expect(result).toEqual({ outcome: "skipped_already_acked", revisionId: "rev-1" });
    expect(createBqBooking).not.toHaveBeenCalled();
    expect(ackChannexRevision).not.toHaveBeenCalled();
  });

  it("never creates a second BQ booking for a duplicate 'new' revision (already has bq_bookingid)", async () => {
    vi.mocked(otaBookingRepo.upsertOtaBooking).mockResolvedValue({
      ...OTA_BOOKING_NEW,
      bq_orderid: "ORD-1",
      bq_bookingid: "BK-1",
    } as never);

    const result = await processRevision(makeRevision(), "corr-1");

    expect(createBqBooking).not.toHaveBeenCalled();
    expect(ackChannexRevision).toHaveBeenCalledWith("rev-1", "corr-1");
    expect(result).toMatchObject({ outcome: "acked", bqBookingId: "BK-1" });
  });
});

describe("processRevision - new booking", () => {
  it("creates the BQ booking with booking_type=OTA, booking_status=Hard and the Channex amount, then verifies and acks", async () => {
    vi.mocked(createBqBooking).mockResolvedValue({
      message: "ok",
      order_id: "ORD-1",
      booking_id: "BK-1",
      billing: { billing_id: "b1", final_amount: 5000, currency: "INR" },
    });
    vi.mocked(findBqBookingById).mockResolvedValue({ bookingid: "BK-1" } as never);

    const result = await processRevision(makeRevision(), "corr-1");

    expect(revisionRepo.createOtaBookingRevision).toHaveBeenCalledWith(
      expect.objectContaining({ guestName: "Jane Doe" })
    );
    expect(createBqBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        guest: expect.objectContaining({ emailid: "jane@example.com", firstname: "Jane", lastname: "Doe" }),
        booking: expect.objectContaining({
          room_type: "Double",
          quantity: 1,
          booking_type: "OTA",
          booking_status: "Hard",
          fixed_amount: 5000,
        }),
      }),
      "corr-1"
    );
    expect(otaBookingRepo.setBqBookingRef).toHaveBeenCalledWith("ota-booking-1", "ORD-1", "BK-1");
    expect(revisionRepo.markRevisionAcked).toHaveBeenCalledWith("revision-row-1");
    expect(ackChannexRevision).toHaveBeenCalledWith("rev-1", "corr-1");
    expect(result).toMatchObject({ outcome: "acked", bqOrderId: "ORD-1", bqBookingId: "BK-1" });
  });

  it("falls back to splitting a combined name on the first space when surname is missing", async () => {
    vi.mocked(createBqBooking).mockResolvedValue({
      message: "ok",
      order_id: "ORD-1",
      booking_id: "BK-1",
      billing: { billing_id: "b1", final_amount: 5000, currency: "INR" },
    });
    vi.mocked(findBqBookingById).mockResolvedValue({ bookingid: "BK-1" } as never);

    await processRevision(makeRevision({ customer: { name: "Jane Doe", mail: "jane@example.com" } }), "corr-1");

    expect(createBqBooking).toHaveBeenCalledWith(
      expect.objectContaining({ guest: expect.objectContaining({ firstname: "Jane", lastname: "Doe" }) }),
      "corr-1"
    );
  });

  it("blocks (does not call BQ) when the guest has no email", async () => {
    const result = await processRevision(makeRevision({ customer: { name: "No Email" } }), "corr-1");

    expect(createBqBooking).not.toHaveBeenCalled();
    expect(revisionRepo.incrementProcessingAttempts).toHaveBeenCalledWith("revision-row-1", expect.stringContaining("email"));
    expect(result).toMatchObject({ outcome: "blocked" });
  });

  it("blocks when the room type isn't mapped to any onboarded BQ room type on this property", async () => {
    vi.mocked(getBqRoomTypes).mockResolvedValue([]);

    const result = await processRevision(makeRevision(), "corr-1");

    expect(createBqBooking).not.toHaveBeenCalled();
    expect(result).toMatchObject({ outcome: "blocked" });
  });

  it("blocks when the rate plan isn't mapped to any GQ rate plan", async () => {
    vi.mocked(ratePlanRepo.findRatePlanByCxId).mockResolvedValue(null);

    const result = await processRevision(makeRevision(), "corr-1");

    expect(createBqBooking).not.toHaveBeenCalled();
    expect(result).toMatchObject({ outcome: "blocked" });
  });

  it("fails without persisting anything BQ-side when the Channex property doesn't map to any onboarded BQ property", async () => {
    vi.mocked(listBqProperties).mockResolvedValue([]);

    const result = await processRevision(makeRevision(), "corr-1");

    expect(otaBookingRepo.upsertOtaBooking).not.toHaveBeenCalled();
    expect(createBqBooking).not.toHaveBeenCalled();
    expect(result).toMatchObject({ outcome: "failed" });
  });

  it("blocks and records the error when BQ rejects the booking creation call", async () => {
    vi.mocked(createBqBooking).mockRejectedValue(new Error("BQ rejected the booking: room type not found"));

    const result = await processRevision(makeRevision(), "corr-1");

    expect(revisionRepo.incrementProcessingAttempts).toHaveBeenCalledWith(
      "revision-row-1",
      expect.stringContaining("room type not found")
    );
    expect(ackChannexRevision).not.toHaveBeenCalled();
    expect(result).toMatchObject({ outcome: "blocked" });
  });
});

describe("processRevision - cancellation", () => {
  it("cancels the BQ booking and acks when a bq_orderid already exists", async () => {
    vi.mocked(otaBookingRepo.upsertOtaBooking).mockResolvedValue({
      ...OTA_BOOKING_NEW,
      bq_orderid: "ORD-1",
      bq_bookingid: "BK-1",
    } as never);

    const result = await processRevision(makeRevision({ status: "cancelled" }), "corr-1");

    expect(cancelBqBooking).toHaveBeenCalledWith("ORD-1", expect.any(String), "corr-1");
    expect(otaBookingRepo.setOtaBookingStatus).toHaveBeenCalledWith("ota-booking-1", "cancelled");
    expect(ackChannexRevision).toHaveBeenCalledWith("rev-1", "corr-1");
    expect(result).toMatchObject({ outcome: "acked" });
  });

  it("blocks a cancellation when no BQ booking was ever created for it", async () => {
    const result = await processRevision(makeRevision({ status: "cancelled" }), "corr-1");

    expect(cancelBqBooking).not.toHaveBeenCalled();
    expect(result).toMatchObject({ outcome: "blocked" });
  });
});

describe("processRevision - modification", () => {
  it("modifies the BQ booking and acks when a bq_bookingid already exists", async () => {
    vi.mocked(otaBookingRepo.upsertOtaBooking).mockResolvedValue({
      ...OTA_BOOKING_NEW,
      bq_orderid: "ORD-1",
      bq_bookingid: "BK-1",
    } as never);

    const result = await processRevision(makeRevision({ status: "modified" }), "corr-1");

    expect(modifyBqBooking).toHaveBeenCalledWith(
      "BK-1",
      expect.objectContaining({ newRoomTypeName: "Double" }),
      "corr-1"
    );
    expect(ackChannexRevision).toHaveBeenCalledWith("rev-1", "corr-1");
    expect(result).toMatchObject({ outcome: "acked" });
  });

  it("blocks a modification when no BQ booking was ever created for it", async () => {
    const result = await processRevision(makeRevision({ status: "modified" }), "corr-1");

    expect(modifyBqBooking).not.toHaveBeenCalled();
    expect(result).toMatchObject({ outcome: "blocked" });
  });
});

const USER = { id: "gq-user-1", bqUserId: 1, propertyId: 1, roles: ["Super_Admin"] };

const OTA_BOOKING_ROW = {
  id: "ota-booking-1",
  bq_property_id: 1,
  cx_booking_id: "cx-booking-1",
  ota_name: "channex",
  unique_id: "OTA-123",
  status: "new",
  currency: "INR",
  bq_orderid: "ORD-1",
  bq_bookingid: "BK-1",
  created_at: new Date("2026-09-24T00:00:00Z"),
  updated_at: new Date("2026-09-24T00:00:00Z"),
};

const REVISION_DB_ROW = {
  id: "revision-row-1",
  ota_booking_id: "ota-booking-1",
  cx_revision_id: "rev-1",
  status: "new",
  arrival_date: new Date("2026-10-01T00:00:00Z"),
  departure_date: new Date("2026-10-03T00:00:00Z"),
  amount_minor_units: 500000,
  currency: "INR",
  guest_name: "Jane Doe",
  received_at: new Date("2026-09-24T00:00:00Z"),
  acked_at: null,
  ack_status: "pending",
  blocking_reason: null,
  processing_attempts: 0,
};

describe("listBookingsForProperty", () => {
  it("403s when the caller does not own the property", async () => {
    await expect(listBookingsForProperty(USER, 2, undefined)).rejects.toMatchObject({ code: "FORBIDDEN_PROPERTY_ACCESS" });
    expect(otaBookingRepo.listOtaBookingsByProperty).not.toHaveBeenCalled();
  });

  it("lists and maps bookings for the caller's own property", async () => {
    vi.mocked(otaBookingRepo.listOtaBookingsByProperty).mockResolvedValue([OTA_BOOKING_ROW] as never);

    const result = await listBookingsForProperty(USER, 1, undefined);

    expect(otaBookingRepo.listOtaBookingsByProperty).toHaveBeenCalledWith(1, undefined);
    expect(result).toEqual([
      {
        id: "ota-booking-1",
        bqPropertyId: 1,
        cxBookingId: "cx-booking-1",
        otaName: "channex",
        uniqueId: "OTA-123",
        status: "new",
        currency: "INR",
        bqOrderId: "ORD-1",
        bqBookingId: "BK-1",
        createdAt: "2026-09-24T00:00:00.000Z",
        updatedAt: "2026-09-24T00:00:00.000Z",
      },
    ]);
  });
});

describe("getBookingForProperty", () => {
  it("404s when the booking doesn't exist", async () => {
    vi.mocked(otaBookingRepo.findOtaBookingById).mockResolvedValue(null);

    await expect(getBookingForProperty(USER, 1, "missing")).rejects.toMatchObject({ code: "BOOKING_NOT_FOUND" });
  });

  it("403s when the booking belongs to a property the caller doesn't own", async () => {
    vi.mocked(otaBookingRepo.findOtaBookingById).mockResolvedValue({ ...OTA_BOOKING_ROW, bq_property_id: 2 } as never);

    await expect(getBookingForProperty(USER, 2, "ota-booking-1")).rejects.toMatchObject({ code: "FORBIDDEN_PROPERTY_ACCESS" });
  });

  it("404s when the booking exists but doesn't belong to the propertyId in the URL", async () => {
    vi.mocked(otaBookingRepo.findOtaBookingById).mockResolvedValue(OTA_BOOKING_ROW as never);

    await expect(getBookingForProperty(USER, 999, "ota-booking-1")).rejects.toMatchObject({ code: "BOOKING_NOT_FOUND" });
  });

  it("returns the booking with its revisions embedded", async () => {
    vi.mocked(otaBookingRepo.findOtaBookingById).mockResolvedValue(OTA_BOOKING_ROW as never);
    vi.mocked(revisionRepo.listRevisionsByBookingId).mockResolvedValue([REVISION_DB_ROW] as never);

    const result = await getBookingForProperty(USER, 1, "ota-booking-1");

    expect(revisionRepo.listRevisionsByBookingId).toHaveBeenCalledWith("ota-booking-1");
    expect(result.id).toBe("ota-booking-1");
    expect(result.revisions).toHaveLength(1);
    expect(result.revisions[0]).toMatchObject({ id: "revision-row-1", ackStatus: "pending", arrivalDate: "2026-10-01" });
  });
});

describe("listBookingRevisionsForProperty", () => {
  it("403s when the caller does not own the property", async () => {
    await expect(listBookingRevisionsForProperty(USER, 2, undefined)).rejects.toMatchObject({ code: "FORBIDDEN_PROPERTY_ACCESS" });
  });

  it("passes the ackStatus filter through to the repository", async () => {
    vi.mocked(revisionRepo.listRevisionsByProperty).mockResolvedValue([{ ...REVISION_DB_ROW, gq_ota_booking: OTA_BOOKING_ROW }] as never);

    const result = await listBookingRevisionsForProperty(USER, 1, "pending");

    expect(revisionRepo.listRevisionsByProperty).toHaveBeenCalledWith(1, "pending");
    expect(result).toHaveLength(1);
  });
});

describe("getBookingRevisionForProperty", () => {
  it("404s when the revision doesn't exist", async () => {
    vi.mocked(revisionRepo.findRevisionById).mockResolvedValue(null);

    await expect(getBookingRevisionForProperty(USER, 1, "missing")).rejects.toMatchObject({ code: "BOOKING_REVISION_NOT_FOUND" });
  });

  it("403s when the revision's booking belongs to a property the caller doesn't own", async () => {
    vi.mocked(revisionRepo.findRevisionById).mockResolvedValue({
      ...REVISION_DB_ROW,
      gq_ota_booking: { ...OTA_BOOKING_ROW, bq_property_id: 2 },
    } as never);

    await expect(getBookingRevisionForProperty(USER, 2, "revision-row-1")).rejects.toMatchObject({ code: "FORBIDDEN_PROPERTY_ACCESS" });
  });

  it("returns the mapped revision when it belongs to the caller's property", async () => {
    vi.mocked(revisionRepo.findRevisionById).mockResolvedValue({
      ...REVISION_DB_ROW,
      gq_ota_booking: OTA_BOOKING_ROW,
    } as never);

    const result = await getBookingRevisionForProperty(USER, 1, "revision-row-1");

    expect(result).toMatchObject({ id: "revision-row-1", cxRevisionId: "rev-1", ackStatus: "pending" });
  });
});
