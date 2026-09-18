/** Ported verbatim from state.users / state.audit (lines 593-605). */

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: "Super Admin" | "Admin" | "Hotel Admin" | "Support User";
  active: boolean;
}

export const adminUsers: AdminUserRow[] = [
  { id: "U-1", name: "Vinod Rao", email: "vinod@rhombusquest.com", role: "Super Admin", active: true },
  { id: "U-2", name: "Meera Iyer", email: "meera@rhombusquest.com", role: "Admin", active: true },
  { id: "U-3", name: "Priya Menon", email: "priya@rhombusquest.com", role: "Hotel Admin", active: true },
  { id: "U-4", name: "Arjun Nair", email: "arjun@rhombusquest.com", role: "Hotel Admin", active: true },
  { id: "U-5", name: "Sana Iqbal", email: "sana@rhombusquest.com", role: "Support User", active: false },
];

export interface AdminRoleRow {
  role: string;
  pages: string;
  write: string;
}

/** Ported from the ROLES object (lines 731-736), summarized for display. */
export const adminRoles: AdminRoleRow[] = [
  { role: "Super Admin", pages: "All panels", write: "All panels" },
  { role: "Admin", pages: "All panels", write: "All panels" },
  { role: "Hotel Admin", pages: "19 panels (no Users/Roles/Reports config)", write: "Properties, mapping, distribution, bookings, error queue, OTA channels" },
  { role: "Support User", pages: "Dashboard, EQ feed, bookings, monitoring, audit, reports", write: "Read-only" },
];

export interface AuditLogRow {
  id: string;
  at: string;
  who: string;
  cat: "Inbound" | "Forward" | "Guard";
  what: string;
}

export const auditLogRows: AuditLogRow[] = [
  { id: "A-1", at: "2 mins ago", who: "Enterprise Quest (EQ)", cat: "Inbound", what: "Received EQ-4471 — 62 rate rows for Hotel Grand Paradise" },
  { id: "A-2", at: "6 mins ago", who: "System", cat: "Forward", what: "Forwarded EQ-4470 availability refresh — pushed to Channex" },
  { id: "A-3", at: "41 mins ago", who: "System", cat: "Forward", what: "Forwarded min stay restriction for Pagoda Hotel" },
  { id: "A-4", at: "1 hour ago", who: "System", cat: "Guard", what: "Rejected EQ-4467 — property not onboarded to Channex" },
];
