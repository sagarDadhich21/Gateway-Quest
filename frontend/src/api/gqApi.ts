import { apiClient } from "./client";
import { OnboardResponse, PropertyResponse } from "./types";

export async function getProperty(propertyId: number): Promise<PropertyResponse> {
  const response = await apiClient.get<PropertyResponse>(`/properties/${propertyId}`);
  return response.data;
}

export async function onboardProperty(propertyId: number): Promise<OnboardResponse> {
  const response = await apiClient.post<OnboardResponse>(`/properties/${propertyId}/onboard`);
  return response.data;
}
