import { apiClient } from "./client";
import {
  AccountConfigCreatedResponse,
  AccountConfigResponse,
  ApiLogResponse,
  AriSnapshotResponse,
  ChannelMappingResponse,
  ChannelResponse,
  ConnectionTokenResponse,
  CreateAccountConfigRequest,
  CreateRatePlanRequest,
  DailyAvailabilityRow,
  ErrorQueueResponse,
  LoginResponse,
  OnboardResponse,
  RegisterAccountConfigResponse,
  OtaBookingAckStatus,
  OtaBookingDetailResponse,
  OtaBookingResponse,
  OtaBookingRevisionResponse,
  OtaBookingStatus,
  PropertyResponse,
  PushAvailabilityRequest,
  PushAvailabilityResponse,
  PushRestrictionsRequest,
  PushRestrictionsResponse,
  PushTaskResponse,
  RatePlan,
  RoomTypeOnboardResult,
  RoomTypeSummary,
  UpdateRatePlanRequest,
  WebhookLogResponse,
} from "./types";

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>("/auth/login", { email, password });
  return response.data;
}

export async function getProperty(propertyId: number): Promise<PropertyResponse> {
  const response = await apiClient.get<PropertyResponse>(`/properties/${propertyId}`);
  return response.data;
}

export async function onboardProperty(propertyId: number): Promise<OnboardResponse> {
  const response = await apiClient.post<OnboardResponse>(`/properties/${propertyId}/onboard`);
  return response.data;
}

export async function getRoomTypes(propertyId: number): Promise<RoomTypeSummary[]> {
  const response = await apiClient.get<{ roomTypes: RoomTypeSummary[] }>(`/properties/${propertyId}/room-types`);
  return response.data.roomTypes;
}

export async function onboardRoomTypes(propertyId: number): Promise<RoomTypeOnboardResult[]> {
  const response = await apiClient.post<{ roomTypes: RoomTypeOnboardResult[] }>(
    `/properties/${propertyId}/room-types/onboard`
  );
  return response.data.roomTypes;
}

export async function listRatePlans(propertyId: number): Promise<RatePlan[]> {
  const response = await apiClient.get<{ ratePlans: RatePlan[] }>("/rate-plans", { params: { propertyId } });
  return response.data.ratePlans;
}

export async function createRatePlan(body: CreateRatePlanRequest): Promise<RatePlan> {
  const response = await apiClient.post<RatePlan>("/rate-plans", body);
  return response.data;
}

export async function updateRatePlan(ratePlanId: string, body: UpdateRatePlanRequest): Promise<RatePlan> {
  const response = await apiClient.put<RatePlan>(`/rate-plans/${ratePlanId}`, body);
  return response.data;
}

export async function deleteRatePlan(ratePlanId: string): Promise<void> {
  await apiClient.delete(`/rate-plans/${ratePlanId}`);
}

export async function getAri(propertyId: number, dateFrom: string, dateTo: string): Promise<AriSnapshotResponse> {
  const response = await apiClient.get<AriSnapshotResponse>(`/properties/${propertyId}/ari`, {
    params: { dateFrom, dateTo },
  });
  return response.data;
}

export async function getAriAvailability(
  propertyId: number,
  dateFrom: string,
  dateTo: string
): Promise<DailyAvailabilityRow[]> {
  const response = await apiClient.get<{ availability: DailyAvailabilityRow[] }>(
    `/properties/${propertyId}/ari/availability`,
    { params: { dateFrom, dateTo } }
  );
  return response.data.availability;
}

export async function pushAvailability(
  propertyId: number,
  body: PushAvailabilityRequest
): Promise<PushAvailabilityResponse> {
  const response = await apiClient.post<PushAvailabilityResponse>(
    `/properties/${propertyId}/ari/availability`,
    body
  );
  return response.data;
}

export async function pushRestrictions(
  propertyId: number,
  body: PushRestrictionsRequest
): Promise<PushRestrictionsResponse> {
  const response = await apiClient.post<PushRestrictionsResponse>(
    `/properties/${propertyId}/ari/restrictions`,
    body
  );
  return response.data;
}

export async function listChannels(propertyId: number): Promise<ChannelResponse[]> {
  const response = await apiClient.get<{ channels: ChannelResponse[] }>(`/properties/${propertyId}/channels`);
  return response.data.channels;
}

export async function generateConnectionToken(propertyId: number, username?: string): Promise<ConnectionTokenResponse> {
  const response = await apiClient.post<ConnectionTokenResponse>(`/properties/${propertyId}/channels/connect-token`, {
    username,
  });
  return response.data;
}

export async function getChannel(channelId: string): Promise<ChannelResponse> {
  const response = await apiClient.get<ChannelResponse>(`/channels/${channelId}`);
  return response.data;
}

export async function activateChannel(channelId: string): Promise<ChannelResponse> {
  const response = await apiClient.post<ChannelResponse>(`/channels/${channelId}/activate`);
  return response.data;
}

export async function deactivateChannel(channelId: string): Promise<ChannelResponse> {
  const response = await apiClient.post<ChannelResponse>(`/channels/${channelId}/deactivate`);
  return response.data;
}

export async function listChannelMappings(channelId: string): Promise<ChannelMappingResponse[]> {
  const response = await apiClient.get<{ mappings: ChannelMappingResponse[] }>(`/channels/${channelId}/mappings`);
  return response.data.mappings;
}

export async function deleteChannelMapping(channelId: string, mappingId: string): Promise<void> {
  await apiClient.delete(`/channels/${channelId}/mappings/${mappingId}`);
}

export async function listBookings(propertyId: number, status?: OtaBookingStatus): Promise<OtaBookingResponse[]> {
  const response = await apiClient.get<{ bookings: OtaBookingResponse[] }>(`/properties/${propertyId}/bookings`, {
    params: status ? { status } : undefined,
  });
  return response.data.bookings;
}

export async function getBooking(propertyId: number, bookingId: string): Promise<OtaBookingDetailResponse> {
  const response = await apiClient.get<OtaBookingDetailResponse>(`/properties/${propertyId}/bookings/${bookingId}`);
  return response.data;
}

export async function listBookingRevisions(
  propertyId: number,
  ackStatus?: OtaBookingAckStatus
): Promise<OtaBookingRevisionResponse[]> {
  const response = await apiClient.get<{ revisions: OtaBookingRevisionResponse[] }>(
    `/properties/${propertyId}/booking-revisions`,
    { params: ackStatus ? { ackStatus } : undefined }
  );
  return response.data.revisions;
}

export async function listAccountConfigs(): Promise<AccountConfigResponse[]> {
  const response = await apiClient.get<{ accountConfigs: AccountConfigResponse[] }>("/account-config");
  return response.data.accountConfigs;
}

export async function createAccountConfig(body: CreateAccountConfigRequest): Promise<AccountConfigCreatedResponse> {
  const response = await apiClient.post<AccountConfigCreatedResponse>("/account-config", body);
  return response.data;
}

export async function registerAccountConfigWithChannex(id: string): Promise<RegisterAccountConfigResponse> {
  const response = await apiClient.post<RegisterAccountConfigResponse>(`/account-config/${id}/register-with-channex`);
  return response.data;
}

export async function setAccountConfigActive(id: string, isActive: boolean): Promise<AccountConfigResponse> {
  const response = await apiClient.patch<AccountConfigResponse>(`/account-config/${id}/active`, { isActive });
  return response.data;
}

export async function listPushTasks(limit = 100): Promise<PushTaskResponse[]> {
  const response = await apiClient.get<{ tasks: PushTaskResponse[] }>("/monitoring/tasks", { params: { limit } });
  return response.data.tasks;
}

export async function listApiLogs(limit = 100): Promise<ApiLogResponse[]> {
  const response = await apiClient.get<{ apiLogs: ApiLogResponse[] }>("/monitoring/api-logs", { params: { limit } });
  return response.data.apiLogs;
}

export async function listWebhookLog(limit = 100): Promise<WebhookLogResponse[]> {
  const response = await apiClient.get<{ webhookLogs: WebhookLogResponse[] }>("/monitoring/webhook-log", { params: { limit } });
  return response.data.webhookLogs;
}

export async function listErrorQueue(limit = 100): Promise<ErrorQueueResponse[]> {
  const response = await apiClient.get<{ errors: ErrorQueueResponse[] }>("/monitoring/error-queue", { params: { limit } });
  return response.data.errors;
}
