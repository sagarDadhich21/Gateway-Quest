import { EQ } from "./core";

/** Ported verbatim from state.eqFeed (lines 523-530). */
export interface InboundAriMessage {
  id: string;
  at: string;
  pid: string;
  kind: "rate" | "availability" | "restriction";
  rows: number;
  status: "Pending review" | "Applied" | "Rejected" | "Partially applied";
  note: string;
}

export const inboundAriMessages: InboundAriMessage[] = [
  { id: "EQ-4471", at: "2 mins ago", pid: "PR-001", kind: "rate", rows: 62, status: "Pending review", note: "Weekend rate uplift, 31 days" },
  { id: "EQ-4470", at: "6 mins ago", pid: "PR-001", kind: "availability", rows: 14, status: "Applied", note: "Nightly availability refresh" },
  { id: "EQ-4469", at: "18 mins ago", pid: "PR-003", kind: "rate", rows: 9, status: "Pending review", note: "BAR drop for shoulder season" },
  { id: "EQ-4468", at: "41 mins ago", pid: "PR-002", kind: "restriction", rows: 7, status: "Applied", note: "Min stay 2 on long weekend" },
  { id: "EQ-4467", at: "1 hour ago", pid: "PR-004", kind: "availability", rows: 11, status: "Rejected", note: "Property not onboarded to Channex" },
  { id: "EQ-4466", at: "2 hours ago", pid: "PR-001", kind: "rate", rows: 40, status: "Partially applied", note: "3 rows rejected by Channex warnings" },
];

/** Ported verbatim from the `rules` array inside PAGES.eqrules (lines 1345-1354). */
export const fieldOwnershipRules: Array<[string, string, string]> = [
  ["Availability (per room type)", EQ.name, "Forwarded automatically — held only if the oversell guard trips or the room type is unmapped"],
  ["Rate (per rate plan)", EQ.name, "Forwarded automatically — held only if the rate is zero/negative or the rate plan is unmapped"],
  ["Min stay / Max stay", EQ.name, "Forwarded automatically as received"],
  ["CTA / CTD", EQ.name, "Forwarded automatically as received"],
  ["Stop sell", EQ.name, "Forwarded automatically — shown with a visibility flag because of its revenue impact"],
  ["Room types & rate plans", "Gateway Quest", "Created and mapped here, then pushed to Channex"],
  ["Channel mapping", "Gateway Quest", "Owned entirely by Gateway Quest"],
  ["Bookings", "Channex", "Flow inbound only, then acknowledged back to EQ"],
];
