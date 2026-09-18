/** Ported verbatim from state.properties / state.roomTypes / state.ratePlans / state.channels (lines 492-522). */

export interface ChannexPropertyRow {
  id: string;
  name: string;
  eqCode: string;
  cxId: string | null;
  active: boolean;
  currency: string;
  minStayType: "both" | "arrival";
  onboarded: boolean;
  country: string;
  timeZone: string;
  defaultRatePlan: string | null;
  defaultInventory: number | null;
  syncFrequency: string;
  reservationSyncMode: string;
}

export const channexProperties: ChannexPropertyRow[] = [
  { id: "PR-001", name: "Hotel Grand Paradise", eqCode: "HGP", cxId: "716305c4-561a-4561-a187-7f5b8aeb5920", active: true, currency: "INR", minStayType: "both", onboarded: true, country: "India", timeZone: "Asia/Kolkata", defaultRatePlan: "RP-1", defaultInventory: 20, syncFrequency: "Every 15 seconds", reservationSyncMode: "Push (webhook) + poll fallback" },
  { id: "PR-002", name: "Pagoda Hotel", eqCode: "PGH", cxId: "5648db98-e082-49e8-a428-2fd3250b47dd", active: true, currency: "INR", minStayType: "arrival", onboarded: true, country: "India", timeZone: "Asia/Kolkata", defaultRatePlan: "RP-4", defaultInventory: 14, syncFrequency: "Every 30 seconds", reservationSyncMode: "Push (webhook) + poll fallback" },
  { id: "PR-003", name: "ABC Residency", eqCode: "ABR", cxId: "954ee839-2598-431b-8c35-8aa68f7b127d", active: true, currency: "INR", minStayType: "both", onboarded: true, country: "India", timeZone: "Asia/Kolkata", defaultRatePlan: "RP-5", defaultInventory: 18, syncFrequency: "Every 1 minute", reservationSyncMode: "Pull (polling) only" },
  { id: "PR-004", name: "Wellness Quest Spa Resort", eqCode: "WQS", cxId: null, active: false, currency: "INR", minStayType: "both", onboarded: false, country: "India", timeZone: "Asia/Kolkata", defaultRatePlan: null, defaultInventory: null, syncFrequency: "Every 5 minutes", reservationSyncMode: "Push (webhook) + poll fallback" },
];

export interface ChannexRoomTypeRow {
  id: string;
  pid: string;
  eqName: string;
  cxId: string | null;
  cxTitle: string | null;
  occ: number;
  count: number;
  mapped: boolean;
}

export const channexRoomTypes: ChannexRoomTypeRow[] = [
  { id: "RT-1", pid: "PR-001", eqName: "Deluxe Room", cxId: "994d1375-dbbd-4072-8724-b2ab32ce781b", cxTitle: "Deluxe Room", occ: 2, count: 20, mapped: true },
  { id: "RT-2", pid: "PR-001", eqName: "Suite", cxId: "f477e6a0-8e9d-4d6f-b506-fb394504d2bc", cxTitle: "Suite", occ: 3, count: 8, mapped: true },
  { id: "RT-3", pid: "PR-001", eqName: "Executive Suite", cxId: null, cxTitle: null, occ: 3, count: 5, mapped: false },
  { id: "RT-4", pid: "PR-002", eqName: "Deluxe Room", cxId: "a1b2c3d4-1111-4c2a-9f01-aa0000000001", cxTitle: "Deluxe", occ: 2, count: 14, mapped: true },
  { id: "RT-5", pid: "PR-002", eqName: "Suite", cxId: null, cxTitle: null, occ: 3, count: 6, mapped: false },
  { id: "RT-6", pid: "PR-003", eqName: "Standard Room", cxId: "b2c3d4e5-2222-4c2a-9f01-aa0000000002", cxTitle: "Standard", occ: 2, count: 18, mapped: true },
  { id: "RT-7", pid: "PR-003", eqName: "Executive", cxId: null, cxTitle: null, occ: 2, count: 7, mapped: false },
];

export interface ChannexRatePlanRow {
  id: string;
  pid: string;
  rtId: string;
  eqName: string;
  cxId: string | null;
  cxTitle: string | null;
  sellMode: "per_room" | "per_person";
  occ: number;
  mapped: boolean;
}

export const channexRatePlans: ChannexRatePlanRow[] = [
  { id: "RP-1", pid: "PR-001", rtId: "RT-1", eqName: "Best Available Rate", cxId: "bab451e7-9ab1-4cc4-aa16-107bf7bbabb2", cxTitle: "Best Available Rate", sellMode: "per_room", occ: 2, mapped: true },
  { id: "RP-2", pid: "PR-001", rtId: "RT-1", eqName: "Non-Refundable", cxId: "a07e712e-cb34-4ec9-b085-63e59a88c249", cxTitle: "Non Refundable", sellMode: "per_room", occ: 2, mapped: true },
  { id: "RP-3", pid: "PR-001", rtId: "RT-2", eqName: "Corporate Rate", cxId: null, cxTitle: null, sellMode: "per_room", occ: 2, mapped: false },
  { id: "RP-4", pid: "PR-002", rtId: "RT-4", eqName: "Best Available Rate", cxId: "c9c80104-af3b-47b2-8a2f-ba7e544638f3", cxTitle: "BAR", sellMode: "per_person", occ: 2, mapped: true },
  { id: "RP-5", pid: "PR-003", rtId: "RT-6", eqName: "Best Available Rate", cxId: "0db682fe-e86b-43c5-8f0c-d055737f8dd9", cxTitle: "BAR", sellMode: "per_room", occ: 2, mapped: true },
  { id: "RP-6", pid: "PR-003", rtId: "RT-7", eqName: "Executive Flexible", cxId: null, cxTitle: null, sellMode: "per_room", occ: 2, mapped: false },
];

export interface OtaChannelRow {
  id: string;
  code: string;
  name: string;
  pid: string;
  status: "Active" | "Warning" | "Not mapped" | "Paused";
  mappedRooms: number;
  totalRooms: number;
  lastSync: string;
  bookings30d: number;
}

export const otaChannels: OtaChannelRow[] = [
  { id: "CH-1", code: "BookingCom", name: "Booking.com", pid: "PR-001", status: "Active", mappedRooms: 2, totalRooms: 3, lastSync: "1 min ago", bookings30d: 148 },
  { id: "CH-2", code: "Expedia", name: "Expedia", pid: "PR-001", status: "Warning", mappedRooms: 2, totalRooms: 3, lastSync: "38 mins ago", bookings30d: 61 },
  { id: "CH-3", code: "AirBNB", name: "Airbnb", pid: "PR-001", status: "Active", mappedRooms: 2, totalRooms: 3, lastSync: "4 mins ago", bookings30d: 33 },
  { id: "CH-4", code: "Agoda", name: "Agoda", pid: "PR-002", status: "Not mapped", mappedRooms: 0, totalRooms: 2, lastSync: "—", bookings30d: 0 },
  { id: "CH-5", code: "HostelWorld", name: "Hostelworld", pid: "PR-003", status: "Active", mappedRooms: 1, totalRooms: 2, lastSync: "12 mins ago", bookings30d: 19 },
  { id: "CH-6", code: "Ctrip", name: "Trip.com", pid: "PR-003", status: "Paused", mappedRooms: 1, totalRooms: 2, lastSync: "3 hours ago", bookings30d: 7 },
];

export function propById(id: string | null): ChannexPropertyRow | null {
  return channexProperties.find((p) => p.id === id) ?? null;
}

export function propName(id: string | null): string {
  return propById(id)?.name ?? "—";
}

export function roomTypeById(id: string | null): ChannexRoomTypeRow | null {
  return channexRoomTypes.find((r) => r.id === id) ?? null;
}

export function ratePlanById(id: string | null): ChannexRatePlanRow | null {
  return channexRatePlans.find((r) => r.id === id) ?? null;
}

export const connectionConfig = {
  environment: "Staging",
  baseUrl: "https://staging.channex.io/api/v1",
  apiKeyMasked: "ck_stg_•••••••••4f21",
  webhookUrl: "https://gwq.rhombusquest.com/hooks/channex",
  rateLimit: "10 requests / min / property",
  lastTestedAt: "182ms latency · Connected",
};
