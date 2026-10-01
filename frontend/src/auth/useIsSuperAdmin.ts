import { getSession } from "./session";

/** True when the logged-in user's GQ token carries BQ's "Super_Admin" role - gates the account-config (webhook) admin pages, matching requireAdmin on the backend. */
export function useIsSuperAdmin(): boolean {
  return getSession()?.user.roles.includes("Super_Admin") ?? false;
}
