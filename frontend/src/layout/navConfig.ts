export interface NavItem {
  label: string;
  path: string;
  icon: string;
}

export interface NavGroup {
  title: string | null;
  items: NavItem[];
}

/**
 * Ported verbatim from the NAV array in gateway_quest_channex.html (lines 742-754) -
 * group labels, item labels and icon names all match the source exactly. Route paths
 * are this app's own (the source is a single-page app with in-memory page keys, not
 * URLs), and "My Property" is the one addition beyond the source: it's the real,
 * backend-connected page this app has that the source mock never did.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [
      { label: "Dashboard", path: "/dashboard", icon: "home" },
      { label: "My Property", path: "/my-property", icon: "building" },
    ],
  },
  {
    title: "EQ — Source of Truth",
    items: [
      { label: "Inventory Calendar", path: "/eq/inventory-calendar", icon: "calendar" },
      { label: "Inbound ARI Feed", path: "/eq/inbound-ari-feed", icon: "arrow-down" },
      { label: "Field Ownership", path: "/eq/field-ownership", icon: "sliders" },
    ],
  },
  {
    title: "ARI Status (Read-only)",
    items: [{ label: "Inbound ARI Status", path: "/ari-status", icon: "check-circle" }],
  },
  {
    title: "Channex Middleware",
    items: [
      { label: "Connection", path: "/channex/connection", icon: "zap" },
      { label: "Properties", path: "/channex/properties", icon: "building" },
      { label: "Room Types", path: "/channex/room-types", icon: "grid" },
      { label: "Rate Plans", path: "/channex/rate-plans", icon: "tag" },
      { label: "OTA Channels", path: "/channex/ota-channels", icon: "swap" },
    ],
  },
  {
    title: "Mapping",
    items: [
      { label: "Room Type Mapping", path: "/mapping/room-types", icon: "list" },
      { label: "Rate Plan Mapping", path: "/mapping/rate-plans", icon: "list-check" },
    ],
  },
  {
    title: "Distribution",
    items: [
      { label: "Availability Push", path: "/distribution/availability", icon: "upload" },
      { label: "Rates Push", path: "/distribution/rates", icon: "banknote" },
      { label: "Restrictions", path: "/distribution/restrictions", icon: "ban" },
    ],
  },
  {
    title: "Bookings",
    items: [{ label: "Booking Revisions", path: "/bookings/revisions", icon: "mail" }],
  },
  {
    title: "Monitoring",
    items: [
      { label: "Channex Tasks", path: "/monitoring/tasks", icon: "activity" },
      { label: "API Logs", path: "/monitoring/api-logs", icon: "terminal" },
      { label: "Webhook Log", path: "/monitoring/webhook-log", icon: "refresh" },
      { label: "Error Queue", path: "/monitoring/error-queue", icon: "alert-triangle" },
    ],
  },
  {
    title: "Reports",
    items: [{ label: "Reports", path: "/reports", icon: "bar-chart" }],
  },
  {
    title: "Administration",
    items: [
      { label: "Users", path: "/admin/users", icon: "users" },
      { label: "Roles", path: "/admin/roles", icon: "shield" },
      { label: "Audit Log", path: "/admin/audit-log", icon: "file-text" },
    ],
  },
  {
    title: null,
    items: [{ label: "Settings", path: "/settings", icon: "cog" }],
  },
];
