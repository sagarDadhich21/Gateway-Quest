import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentPropertyId } from "../auth/useCurrentProperty";
import { extractErrorMessage } from "../api/client";
import { getProperty, getRoomTypes, listRatePlans } from "../api/gqApi";
import { PropertyResponse, RatePlan, RoomTypeSummary } from "../api/types";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";

export function Dashboard() {
  const propertyId = useCurrentPropertyId();
  const [property, setProperty] = useState<PropertyResponse | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomTypeSummary[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId === null) return;
    setLoading(true);
    setError(null);
    Promise.all([getProperty(propertyId), getRoomTypes(propertyId), listRatePlans(propertyId)])
      .then(([p, rt, rp]) => {
        setProperty(p);
        setRoomTypes(rt);
        setRatePlans(rp);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [propertyId]);

  if (propertyId === null) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Live view of the EQ → Gateway Quest → Channex pipeline" />
        <div className="card">
          <p className="muted">Your account has no assigned property, so there is nothing to load here.</p>
        </div>
      </div>
    );
  }

  const roomTypesOnboarded = roomTypes.filter((t) => t.channex.onboarded).length;
  const ratePlansOnboarded = ratePlans.filter((p) => p.channex.onboarded).length;

  return (
    <div>
      <PageHeader title="Dashboard" description="Live view of the EQ → Gateway Quest → Channex pipeline" />

      {error && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">{error}</p>
        </div>
      )}

      <div className="stat-grid">
        <div className="card stat-tile">
          <div className="stat-tile__label">Property onboarded</div>
          <div className="stat-tile__value">
            {property ? (property.channex.onboarded ? "Yes" : "No") : loading ? "…" : "—"}
          </div>
          <div className="stat-tile__hint"><Link to="/channex/properties">View property →</Link></div>
        </div>
        <div className="card stat-tile">
          <div className="stat-tile__label">Room types onboarded</div>
          <div className="stat-tile__value">{roomTypesOnboarded} / {roomTypes.length}</div>
          <div className="stat-tile__hint"><Link to="/channex/room-types">View room types →</Link></div>
        </div>
        <div className="card stat-tile">
          <div className="stat-tile__label">Rate plans onboarded</div>
          <div className="stat-tile__value">{ratePlansOnboarded} / {ratePlans.length}</div>
          <div className="stat-tile__hint"><Link to="/channex/rate-plans">View rate plans →</Link></div>
        </div>
        <div className="card stat-tile">
          <div className="stat-tile__label">Currency</div>
          <div className="stat-tile__value">{property?.currency ?? "—"}</div>
        </div>
      </div>

      {property && (
        <div className="card">
          <h2 className="section-title">{property.name}</h2>
          <dl className="property-detail-list">
            <div className="property-detail-list__row">
              <dt>Channex property</dt>
              <dd>
                {property.channex.onboarded ? (
                  <StatusBadge label="Onboarded to Channex" tone="success" />
                ) : (
                  <StatusBadge label="Not onboarded" tone="pending" />
                )}
              </dd>
            </div>
            <div className="property-detail-list__row">
              <dt>City</dt>
              <dd>{property.city}</dd>
            </div>
            <div className="property-detail-list__row">
              <dt>Time zone</dt>
              <dd>{property.timeZone ?? "Not set"}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
