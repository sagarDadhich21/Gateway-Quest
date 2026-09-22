import { apiClient } from "./client";
import {
  AriSnapshotResponse,
  CreateRatePlanRequest,
  DailyAvailabilityRow,
  LoginResponse,
  OnboardResponse,
  PropertyResponse,
  PushAvailabilityRequest,
  PushAvailabilityResponse,
  PushRestrictionsRequest,
  PushRestrictionsResponse,
  RatePlan,
  RoomTypeOnboardResult,
  RoomTypeSummary,
  UpdateRatePlanRequest,
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
