import { getSession } from "./session";

/** The property every real-data page scopes its API calls to - the logged-in user's own assigned property (aq_users.property_id, carried on the GQ session). */
export function useCurrentPropertyId(): number | null {
  return getSession()?.user.propertyId ?? null;
}
