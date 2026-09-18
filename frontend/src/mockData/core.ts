/**
 * Ported verbatim from the CX/EQ/state.settings/state.counters objects in
 * gateway_quest_channex.html (lines 467-489, 612-619).
 */

export const CX = {
  baseUrl: "https://staging.channex.io/api/v1",
  authHeader: "user-api-key",
  apiKeyMasked: "ck_stg_•••••••••4f21",
  keySet: true,
  status: "Connected",
  latency: 182,
  rateLimit: { limit: 10, used: 3, window: "per minute, per property" },
  webhookUrl: "https://gwq.rhombusquest.com/hooks/channex",
  webhookSecretSet: true,
  webhookEvents: [
    "booking_new",
    "booking_modification",
    "booking_cancellation",
    "booking_unmapped_room",
    "booking_unmapped_rate",
    "non_acked_booking",
    "ari",
    "sync_error",
    "sync_warning",
    "rate_error",
  ],
  maxMessageMb: 10,
};

export const EQ = {
  name: "Enterprise Quest (EQ)",
  endpoint: "https://eq.rhombusquest.com/api/v1/ari/outbound",
  status: "Connected",
  lastMessage: "2 mins ago",
  mode: "Push (webhook)",
  batchSeconds: 45,
};

export const settings = {
  availabilityOversellGuard: true,
  nightlyFullRefresh: true,
  batchWindowSec: 45,
  ackOnEqSuccess: true,
};

export const counters = { pushesToday: 186, bookingsToday: 24 };
