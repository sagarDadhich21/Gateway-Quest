import { AxiosError } from "axios";
import axios from "axios";
import { clearSession, getToken } from "../auth/session";
import { GqApiErrorBody } from "./types";

const baseURL = import.meta.env.VITE_GQ_API_BASE_URL ?? "http://localhost:4000/api/gq";

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * A 401 here means GQ's own session token is missing/expired (not a BQ/EQ credential
 * issue - see authenticate.ts) - the stored session is stale, so it's cleared and the
 * user is sent back to /login rather than leaving them looking at a broken page.
 * Skipped for /auth/login itself - a failed login attempt must surface as a form
 * error, not force-navigate away from the login page mid-submit.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (err: AxiosError) => {
    if (err.response?.status === 401 && !err.config?.url?.includes("/auth/login")) {
      clearSession();
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(err);
  }
);

/**
 * Every error path in the gq backend returns { error: { code, message, ... } } (see
 * errorHandler.ts) - this pulls a human-readable message out of that envelope, with a
 * generic fallback for anything else (network failure, unexpected shape).
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
