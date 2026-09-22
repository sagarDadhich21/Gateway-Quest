import { useEffect, useState } from "react";
import { extractErrorMessage } from "../../api/client";
import { getAri, getRoomTypes, listRatePlans } from "../../api/gqApi";
import { RatePlan, RestrictionRow, RoomTypeSummary } from "../../api/types";

export interface RestrictionsData {
  ratePlans: RatePlan[];
  roomTypes: RoomTypeSummary[];
  restrictions: RestrictionRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Shared by Restrictions.tsx and RatesPush.tsx - both are views over the exact same
 * data (GET /ari's restriction rows, which cover every rate plan in the date range at
 * once - the endpoint has no ratePlanId filter) and both push through the same
 * POST /ari/restrictions endpoint, just surfacing different fields of the same rows.
 */
export function useRestrictionsData(propertyId: number | null, dateFrom: string, dateTo: string): RestrictionsData {
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeSummary[]>([]);
  const [restrictions, setRestrictions] = useState<RestrictionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (propertyId === null) return;
    setLoading(true);
    setError(null);
    try {
      const [plans, types, ari] = await Promise.all([
        listRatePlans(propertyId),
        getRoomTypes(propertyId),
        getAri(propertyId, dateFrom, dateTo),
      ]);
      setRatePlans(plans);
      setRoomTypes(types);
      setRestrictions(ari.restrictions);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, dateFrom, dateTo]);

  return { ratePlans, roomTypes, restrictions, loading, error, reload };
}
