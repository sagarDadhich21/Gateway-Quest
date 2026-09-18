/** Ported verbatim from state.tasks / state.apiLogs / state.webhookLog / state.errors (lines 561-592). */

export interface ChannexTaskRow {
  id: string;
  pid: string;
  endpoint: "/availability" | "/restrictions";
  rows: number;
  status: "Applied" | "Applied with warnings" | "Processing" | "Failed";
  warnings: number;
  at: string;
}

export const channexTasks: ChannexTaskRow[] = [
  { id: "eb31d631-4fcc-478a-80c3-bf7a2acf0699", pid: "PR-001", endpoint: "/availability", rows: 14, status: "Applied", warnings: 0, at: "6 mins ago" },
  { id: "7c1a92f0-2b55-4a19-9d33-51cc7f2210aa", pid: "PR-001", endpoint: "/restrictions", rows: 40, status: "Applied with warnings", warnings: 3, at: "2 hours ago" },
  { id: "9f2b47ac-88d1-4f0b-b6de-3ac9911f7e02", pid: "PR-002", endpoint: "/restrictions", rows: 7, status: "Processing", warnings: 0, at: "41 mins ago" },
  { id: "3ad77e19-5c0a-4d8e-9b21-77aa0cd41133", pid: "PR-003", endpoint: "/restrictions", rows: 9, status: "Failed", warnings: 9, at: "18 mins ago" },
];

export interface ApiLogRow {
  id: string;
  method: string;
  endpoint: string;
  code: number;
  ms: number;
  pid: string | null;
  warnings: number;
  at: string;
}

export const apiLogs: ApiLogRow[] = [
  { id: "L-1", method: "POST", endpoint: "/availability", code: 200, ms: 182, pid: "PR-001", warnings: 0, at: "6 mins ago" },
  { id: "L-2", method: "POST", endpoint: "/restrictions", code: 200, ms: 240, pid: "PR-001", warnings: 3, at: "2 hours ago" },
  { id: "L-3", method: "POST", endpoint: "/restrictions", code: 429, ms: 12, pid: "PR-003", warnings: 0, at: "18 mins ago" },
  { id: "L-4", method: "GET", endpoint: "/bookings/feed", code: 200, ms: 96, pid: null, warnings: 0, at: "1 min ago" },
  { id: "L-5", method: "POST", endpoint: "/availability", code: 422, ms: 88, pid: "PR-004", warnings: 11, at: "1 hour ago" },
];

export interface WebhookLogRow {
  id: string;
  event: string;
  ref: string;
  attempt: number;
  code: number | null;
  at: string;
  next: string | null;
}

export const webhookLogs: WebhookLogRow[] = [
  { id: "WH-1", event: "booking_new", ref: "BR-88213", attempt: 1, code: 200, at: "4 mins ago", next: null },
  { id: "WH-2", event: "booking_modification", ref: "BR-88110", attempt: 1, code: 200, at: "26 mins ago", next: null },
  { id: "WH-3", event: "ari", ref: "ARI-5521", attempt: 3, code: 500, at: "32 mins ago", next: "4 minutes" },
  { id: "WH-4", event: "booking_cancellation", ref: "BR-44092", attempt: 1, code: 200, at: "2 hours ago", next: null },
];

export interface ErrorQueueRow {
  id: string;
  ref: string;
  kind: "Rate Limit (429)" | "Validation" | "Channex Warning" | "Unmapped Room";
  pid: string;
  detail: string;
  retries: number;
  status: "Pending" | "Resolved" | "Dismissed";
  at: string;
}

export const errorQueueRows: ErrorQueueRow[] = [
  { id: "ER-1", ref: "3ad77e19", kind: "Rate Limit (429)", pid: "PR-003", detail: "POST /restrictions rejected — 429 Too Many Requests. Batch window exceeded.", retries: 2, status: "Pending", at: "18 mins ago" },
  { id: "ER-2", ref: "L-5", kind: "Validation", pid: "PR-004", detail: "property_id is null — Wellness Quest Spa Resort is not onboarded to Channex.", retries: 0, status: "Pending", at: "1 hour ago" },
  { id: "ER-3", ref: "7c1a92f0", kind: "Channex Warning", pid: "PR-001", detail: "3 rows rejected: rate must be greater than 0; min_stay_arrival must be >= 1.", retries: 1, status: "Pending", at: "2 hours ago" },
  { id: "ER-4", ref: "BR-55010", kind: "Unmapped Room", pid: "PR-003", detail: "Booking revision cannot be acknowledged — room type not mapped.", retries: 0, status: "Pending", at: "35 mins ago" },
];
