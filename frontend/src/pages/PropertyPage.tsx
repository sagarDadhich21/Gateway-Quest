import { useEffect, useState } from "react";
import { useCurrentPropertyId } from "../auth/useCurrentProperty";
import { extractErrorMessage } from "../api/client";
import { getProperty, onboardProperty } from "../api/gqApi";
import { PropertyResponse } from "../api/types";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";

const DETAIL_FIELDS: Array<{ label: string; key: keyof PropertyResponse }> = [
  { label: "City", key: "city" },
  { label: "Location", key: "location" },
  { label: "Address", key: "address" },
  { label: "Phone", key: "phone" },
  { label: "Email", key: "email" },
  { label: "Currency", key: "currency" },
  { label: "Country", key: "country" },
  { label: "State", key: "state" },
  { label: "Zip code", key: "zipCode" },
  { label: "Time zone", key: "timeZone" },
];

/** Live BQ data via gq/backend - the property id comes from the logged-in user's own session, same as every other real-data page. */
export function PropertyPage() {
  const propertyId = useCurrentPropertyId();
  const [property, setProperty] = useState<PropertyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  async function loadProperty() {
    if (propertyId === null) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getProperty(propertyId);
      setProperty(data);
    } catch (err) {
      setLoadError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProperty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  async function handleOnboard() {
    if (propertyId === null) return;
    setOnboarding(true);
    setOnboardError(null);
    try {
      await onboardProperty(propertyId);
      await loadProperty();
    } catch (err) {
      setOnboardError(extractErrorMessage(err));
    } finally {
      setOnboarding(false);
    }
  }

  if (propertyId === null) {
    return (
      <div>
        <PageHeader title="My Property" description="Live data from BQ." />
        <div className="card">
          <p className="muted">Your account has no assigned property, so there is nothing to load here.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Property" description="Live data from BQ." />

      {loading && !property && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="muted">Loading…</p>
        </div>
      )}

      {loadError && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">{loadError}</p>
        </div>
      )}

      {property && (
        <div className="card property-card">
          <div className="property-card__header">
            <h2 className="property-card__title">{property.name}</h2>
            {property.channex.onboarded ? (
              <StatusBadge label="Onboarded to Channex" tone="success" />
            ) : (
              <StatusBadge label="Not onboarded" tone="pending" />
            )}
          </div>

          <dl className="property-detail-list">
            {DETAIL_FIELDS.map(({ label, key }) => (
              <div className="property-detail-list__row" key={key}>
                <dt>{label}</dt>
                <dd>{property[key] ? String(property[key]) : <span className="muted">Not set</span>}</dd>
              </div>
            ))}
          </dl>

          <div className="property-card__channex">
            {property.channex.onboarded ? (
              <p className="muted">
                Channex property id: <code>{property.channex.propertyId}</code>
              </p>
            ) : (
              <>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={handleOnboard}
                  disabled={onboarding}
                >
                  {onboarding ? "Onboarding..." : "Onboard on Channex"}
                </button>
                {onboardError && (
                  <p className="form-error" role="alert">{onboardError}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
