/** Ported verbatim from state.bookings (lines 580-585). amount is minor currency units. */
export interface BookingRevisionRow {
  id: string;
  bookingId: string;
  uniqueId: string;
  otaCode: string;
  ota: string;
  pid: string;
  status: "new" | "modified" | "cancelled";
  guest: string;
  amount: number;
  arrival: string;
  departure: string;
  acked: boolean;
  err: string | null;
  receivedMinAgo: number;
}

export const bookingRevisions: BookingRevisionRow[] = [
  { id: "BR-88213", bookingId: "BK-10245", uniqueId: "BDC-88213", otaCode: "BDC-88213", ota: "Booking.com", pid: "PR-001", status: "new", guest: "Ritika Sharma", amount: 2140000, arrival: "2026-08-24", departure: "2026-08-27", acked: false, err: null, receivedMinAgo: 4 },
  { id: "BR-55021", bookingId: "BK-10246", uniqueId: "EXP-55021", otaCode: "EXP-55021", ota: "Expedia", pid: "PR-001", status: "new", guest: "James Carter", amount: 980000, arrival: "2026-08-21", departure: "2026-08-23", acked: false, err: null, receivedMinAgo: 55 },
  { id: "BR-88110", bookingId: "BK-10201", uniqueId: "BDC-88110", otaCode: "BDC-88110", ota: "Booking.com", pid: "PR-001", status: "modified", guest: "Aman Verma", amount: 1560000, arrival: "2026-09-02", departure: "2026-09-05", acked: true, err: null, receivedMinAgo: 20 },
  { id: "BR-44092", bookingId: "BK-10188", uniqueId: "HW-44092", otaCode: "HW-44092", ota: "Hostelworld", pid: "PR-003", status: "cancelled", guest: "Neha Kapoor", amount: 320000, arrival: "2026-08-30", departure: "2026-08-31", acked: true, err: null, receivedMinAgo: 130 },
  { id: "BR-55010", bookingId: "BK-10190", uniqueId: "EXP-55010", otaCode: "EXP-55010", ota: "Expedia", pid: "PR-003", status: "new", guest: "Farah Khan", amount: 760000, arrival: "2026-08-26", departure: "2026-08-29", acked: false, err: "Room type \"Executive\" has no Channex room_type_id for ABC Residency — cannot post to EQ.", receivedMinAgo: 35 },
];
