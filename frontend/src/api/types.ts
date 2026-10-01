/**
 * Types mirroring gq backend's actual response shapes (see ../../backend/src/modules
 * and ../../backend/src/middleware/errorHandler.ts). Kept in sync by hand since
 * frontend and backend are separate TypeScript projects.
 */

export interface GqApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    correlationId: string;
  };
}

export interface PropertyResponse {
  id: number;
  name: string;
  city: string;
  location: string;
  address: string;
  phone: string | null;
  email: string | null;
  currency: string | null;
  country: string | null;
  state: string | null;
  zipCode: string | null;
  timeZone: string | null;
  channex: {
    onboarded: boolean;
    propertyId: string | null;
  };
}

export interface OnboardResponse {
  propertyId: number;
  channexPropertyId: string;
  status: "onboarded" | "already_onboarded";
}

export interface LoginResponse {
  token: string;
  expiresInMinutes: number;
  user: {
    id: string;
    bqUserId: number;
    propertyId: number | null;
    roles: string[];
  };
}

export interface RoomTypeSummary {
  id: number;
  name: string;
  maxOccupancy: number;
  totalRooms: number;
  channex: {
    onboarded: boolean;
    roomTypeId: string | null;
  };
}

export interface RoomTypeOnboardResult {
  roomTypeId: number;
  cxRoomTypeId: string;
  status: "onboarded" | "already_onboarded";
}

export interface RatePlanOption {
  id: string;
  occupancy: number;
  isPrimary: boolean;
  rate: number | null;
}

export interface RatePlan {
  id: string;
  propertyId: number;
  roomTypeId: number;
  name: string;
  currency: string;
  sellMode: string;
  rateMode: string;
  mealType: string | null;
  parentRatePlanId: string | null;
  isDefault: boolean;
  channex: {
    onboarded: boolean;
    ratePlanId: string | null;
  };
  options: RatePlanOption[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRatePlanRequest {
  propertyId: number;
  roomTypeId: number;
  name: string;
  currency?: string;
  sellMode?: "per_room" | "per_person";
  rateMode?: "manual" | "derived" | "auto" | "cascade";
  mealType?: string;
  parentRatePlanId?: string;
  isDefault?: boolean;
  options: Array<{ occupancy: number; isPrimary?: boolean }>;
}

export interface UpdateRatePlanRequest {
  name?: string;
  currency?: string;
  sellMode?: "per_room" | "per_person";
  rateMode?: "manual" | "derived" | "auto" | "cascade";
  mealType?: string;
  isDefault?: boolean;
  options?: Array<{ occupancy: number; isPrimary?: boolean }>;
}

export interface RestrictionRow {
  ratePlanId: string;
  date: string;
  rate: number;
  minStayArrival: number | null;
  minStayThrough: number | null;
  minStay: number | null;
  maxStay: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  stopSell: boolean;
  updatedAt: string;
}

export interface AvailabilitySnapshotRow {
  roomTypeId: number;
  date: string;
  availableRooms: number;
  updatedAt: string;
}

export interface AriSnapshotResponse {
  restrictions: RestrictionRow[];
  availability: AvailabilitySnapshotRow[];
}

export interface DailyAvailabilityRow {
  roomTypeId: number;
  date: string;
  totalRooms: number;
  bookedRooms: number;
  availableRooms: number;
}

export interface PushAvailabilityRequest {
  values: Array<{ roomTypeId: number; date: string; availability: number }>;
}

export interface PushAvailabilityResponse {
  cxTaskId: string;
  verified: boolean;
  snapshots: AvailabilitySnapshotRow[];
}

export interface PushRestrictionsRequest {
  ratePlanId: string;
  values: Array<{
    date: string;
    rate?: number;
    minStayArrival?: number;
    minStayThrough?: number;
    minStay?: number;
    maxStay?: number;
    closedToArrival?: boolean;
    closedToDeparture?: boolean;
    stopSell?: boolean;
  }>;
}

export interface PushRestrictionsResponse {
  cxTaskId: string;
  verified: boolean;
  restrictions: RestrictionRow[];
}

export interface ChannelResponse {
  id: string;
  propertyId: number;
  title: string;
  channel: string;
  currency: string | null;
  isActive: boolean;
  channex: { channelId: string };
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionTokenResponse {
  token: string;
  iframeUrl: string;
  expiresInMinutes: number;
}

export interface ChannelMappingResponse {
  id: string;
  channelId: string;
  roomTypeId: number;
  ratePlanId: string;
  otaRoomCode: string;
  otaRateCode: string;
  channex: { mappingId: string };
}

export type OtaBookingStatus = "new" | "modified" | "cancelled";
export type OtaBookingAckStatus = "pending" | "acked";

export interface OtaBookingResponse {
  id: string;
  bqPropertyId: number;
  cxBookingId: string;
  otaName: string;
  uniqueId: string;
  status: OtaBookingStatus;
  currency: string;
  bqOrderId: string | null;
  bqBookingId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OtaBookingRevisionResponse {
  id: string;
  otaBookingId: string;
  cxRevisionId: string;
  status: OtaBookingStatus;
  arrivalDate: string | null;
  departureDate: string | null;
  amountMinorUnits: number;
  currency: string;
  guestName: string | null;
  ackStatus: OtaBookingAckStatus;
  blockingReason: string | null;
  processingAttempts: number;
  receivedAt: string;
  ackedAt: string | null;
}

export interface OtaBookingDetailResponse extends OtaBookingResponse {
  revisions: OtaBookingRevisionResponse[];
}

export interface AccountConfigResponse {
  id: string;
  bqPropertyId: number | null;
  webhookUrl: string;
  environment: string;
  isActive: boolean;
  sendData: boolean;
  createdAt: string;
}

/** webhookSecret is only ever present here, on the create response - never again afterward. */
export interface AccountConfigCreatedResponse extends AccountConfigResponse {
  webhookSecret: string;
}

export interface CreateAccountConfigRequest {
  webhookUrl: string;
  apiKey: string;
  environment: string;
  bqPropertyId?: number;
  sendData?: boolean;
}

export interface PushTaskResponse {
  id: string;
  taskType: string;
  cxTaskId: string;
  status: string;
  warnings: unknown;
  createdAt: string;
}

export interface ApiLogResponse {
  id: string;
  method: string;
  endpoint: string;
  httpStatus: number;
  latencyMs: number;
  requestBody: unknown;
  responseBody: unknown;
  createdAt: string;
}

export interface WebhookLogResponse {
  id: string;
  event: string;
  ref: string;
  attempt: number;
  httpStatusReturned: number | null;
  receivedAt: string;
  nextRetryAt: string | null;
}

export interface ErrorQueueResponse {
  id: string;
  source: string;
  payload: unknown;
  errorMessage: string;
  retryCount: number;
  createdAt: string;
}
