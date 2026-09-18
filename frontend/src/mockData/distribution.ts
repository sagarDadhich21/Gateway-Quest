/** Ported verbatim from state.availRows / state.rateRows / state.restrRows (lines 539-560). */

export interface AvailabilityPushRow {
  id: string;
  pid: string;
  rtId: string;
  dateFrom: string;
  dateTo: string;
  eqValue: number;
  cxValue: number | null;
  status: "Pending push" | "In sync" | "Blocked";
}

export const availabilityPushRows: AvailabilityPushRow[] = [
  { id: "AV-1", pid: "PR-001", rtId: "RT-1", dateFrom: "2026-08-19", dateTo: "2026-08-25", eqValue: 26, cxValue: 12, status: "Pending push" },
  { id: "AV-2", pid: "PR-001", rtId: "RT-2", dateFrom: "2026-08-19", dateTo: "2026-08-25", eqValue: 6, cxValue: 6, status: "In sync" },
  { id: "AV-3", pid: "PR-001", rtId: "RT-3", dateFrom: "2026-08-19", dateTo: "2026-08-25", eqValue: 5, cxValue: null, status: "Blocked" },
  { id: "AV-4", pid: "PR-002", rtId: "RT-4", dateFrom: "2026-08-19", dateTo: "2026-08-25", eqValue: 11, cxValue: 11, status: "In sync" },
  { id: "AV-5", pid: "PR-003", rtId: "RT-6", dateFrom: "2026-08-19", dateTo: "2026-08-25", eqValue: 15, cxValue: 9, status: "Pending push" },
  { id: "AV-6", pid: "PR-003", rtId: "RT-7", dateFrom: "2026-08-19", dateTo: "2026-08-25", eqValue: 5, cxValue: null, status: "Blocked" },
];

/** eqValue/cxValue are minor currency units. */
export interface RatePushRow {
  id: string;
  pid: string;
  rpId: string;
  dateFrom: string;
  dateTo: string;
  eqValue: number;
  cxValue: number | null;
  status: "Pending push" | "In sync" | "Blocked" | "Rejected";
}

export const ratePushRows: RatePushRow[] = [
  { id: "RA-1", pid: "PR-001", rpId: "RP-1", dateFrom: "2026-08-22", dateTo: "2026-09-21", eqValue: 1050000, cxValue: 780000, status: "Pending push" },
  { id: "RA-2", pid: "PR-001", rpId: "RP-2", dateFrom: "2026-08-22", dateTo: "2026-08-31", eqValue: 210000, cxValue: 700000, status: "Pending push" },
  { id: "RA-3", pid: "PR-001", rpId: "RP-3", dateFrom: "2026-08-22", dateTo: "2026-08-31", eqValue: 620000, cxValue: null, status: "Blocked" },
  { id: "RA-4", pid: "PR-002", rpId: "RP-4", dateFrom: "2026-08-20", dateTo: "2026-09-20", eqValue: 540000, cxValue: 540000, status: "In sync" },
  { id: "RA-5", pid: "PR-003", rpId: "RP-5", dateFrom: "2026-08-20", dateTo: "2026-08-28", eqValue: 0, cxValue: 450000, status: "Rejected" },
  { id: "RA-6", pid: "PR-003", rpId: "RP-6", dateFrom: "2026-08-20", dateTo: "2026-08-28", eqValue: 380000, cxValue: null, status: "Blocked" },
];

export interface RestrictionRow {
  id: string;
  pid: string;
  rpId: string;
  minArr: number;
  minThr: number;
  maxStay: number;
  cta: boolean;
  ctd: boolean;
  stopSell: boolean;
  status: "Pending push" | "In sync" | "Blocked";
}

export const restrictionRows: RestrictionRow[] = [
  { id: "RS-1", pid: "PR-001", rpId: "RP-1", minArr: 1, minThr: 2, maxStay: 14, cta: false, ctd: false, stopSell: false, status: "In sync" },
  { id: "RS-2", pid: "PR-001", rpId: "RP-2", minArr: 2, minThr: 2, maxStay: 10, cta: true, ctd: false, stopSell: false, status: "Pending push" },
  { id: "RS-3", pid: "PR-002", rpId: "RP-4", minArr: 2, minThr: 0, maxStay: 21, cta: false, ctd: false, stopSell: true, status: "Pending push" },
  { id: "RS-4", pid: "PR-003", rpId: "RP-5", minArr: 1, minThr: 1, maxStay: 30, cta: false, ctd: true, stopSell: false, status: "In sync" },
];
