import { LoginResponse } from "../api/types";

const STORAGE_KEY = "gq_session";

export interface GqSession {
  token: string;
  /** The backend's login response has no email field - it's carried here from the login form input instead, since it's what the person actually typed to sign in. */
  email: string;
  user: LoginResponse["user"];
}

export function saveSession(login: LoginResponse, email: string): void {
  const session: GqSession = { token: login.token, email, user: login.user };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getSession(): GqSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GqSession;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
