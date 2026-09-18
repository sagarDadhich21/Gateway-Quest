import { AxiosError } from "axios";
import axios from "axios";
import { GqApiErrorBody } from "./types";

const baseURL = import.meta.env.VITE_GQ_API_BASE_URL ?? "http://localhost:4000/api/gq";

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
});

/**
 * Every error path in the gq backend returns { error: { code, message, ... } } (see
 * errorHandler.ts) - this pulls a human-readable message out of that envelope, with a
 * generic fallback for anything else (network failure, unexpected shape). Note: since
 * there is no login flow in this frontend, calls to auth-gated backend routes will
 * come back as a 401 UNAUTHENTICATED error here - that's expected, not a bug.
 */
export function extractErrorMessage(err: unknown): string {
  const axiosErr = err as AxiosError<GqApiErrorBody>;

  if (axiosErr.isAxiosError) {
    if (!axiosErr.response) {
      return "Could not reach the server. Check your connection and try again.";
    }
    const body = axiosErr.response.data;
    if (body?.error?.message) {
      return body.error.message;
    }
    return `Request failed (${axiosErr.response.status}).`;
  }

  return "An unexpected error occurred.";
}
