/** Ported verbatim from state.reviewQueue (lines 531-538). eqValue/liveValue are in minor currency units when field === "rate". */
export interface ReviewQueueItem {
  id: string;
  msg: string;
  pid: string;
  kind: "rate" | "availability" | "restriction";
  target: string;
  dateFrom: string;
  dateTo: string;
  field: string;
  eqValue: number;
  liveValue: number;
  decision: "Pending" | "Forwarded" | "Held";
}

export const reviewQueueItems: ReviewQueueItem[] = [
  { id: "RV-1", msg: "EQ-4471", pid: "PR-001", kind: "rate", target: "RP-1", dateFrom: "2026-08-22", dateTo: "2026-09-21", field: "rate", eqValue: 1050000, liveValue: 780000, decision: "Pending" },
  { id: "RV-2", msg: "EQ-4471", pid: "PR-001", kind: "rate", target: "RP-2", dateFrom: "2026-08-22", dateTo: "2026-08-31", field: "rate", eqValue: 210000, liveValue: 700000, decision: "Pending" },
  { id: "RV-3", msg: "EQ-4469", pid: "PR-003", kind: "rate", target: "RP-5", dateFrom: "2026-08-20", dateTo: "2026-08-28", field: "rate", eqValue: 0, liveValue: 450000, decision: "Pending" },
  { id: "RV-4", msg: "EQ-4470", pid: "PR-001", kind: "availability", target: "RT-1", dateFrom: "2026-08-19", dateTo: "2026-08-25", field: "availability", eqValue: 26, liveValue: 12, decision: "Pending" },
  { id: "RV-5", msg: "EQ-4469", pid: "PR-003", kind: "availability", target: "RT-7", dateFrom: "2026-08-19", dateTo: "2026-08-26", field: "availability", eqValue: 5, liveValue: 0, decision: "Pending" },
  { id: "RV-6", msg: "EQ-4468", pid: "PR-002", kind: "restriction", target: "RP-4", dateFrom: "2026-08-21", dateTo: "2026-08-24", field: "stop_sell", eqValue: 1, liveValue: 0, decision: "Pending" },
];
