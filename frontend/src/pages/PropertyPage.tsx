import { FormEvent, useState } from "react";
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

/**
 * The one real, functional page in this app - live BQ data via gq/backend, not mock
 * data. There is no login in this frontend, so the property id is entered manually
 * rather than read off a session. The gq/backend endpoints this calls still require a
 * Bearer token (see backend/src/middleware/authenticate.ts) - without one, these calls
 * will come back as a 401 UNAUTHENTICATED error, which is expected until a login flow
 * exists again, not a bug in this page.
 */
export function PropertyPage() {
  const [propertyIdInput, setPropertyIdInput] = useState("");
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [property, setProperty] = useState<PropertyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  async function loadProperty(id: number) {
    setLoading(true);
    setLoadError(null);
    setProperty(null);
    try {
      const data = await getProperty(id);
      setProperty(data);
    } catch (err) {
      setLoadError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const id = Number(propertyIdInput);
    if (!Number.isInteger(id) || id <= 0) {
      setLoadError("Enter a valid property id.");
      return;
    }
    setPropertyId(id);
    void loadProperty(id);
  }

  async function handleOnboard() {
    if (propertyId === null) return;
    setOnboarding(true);
    setOnboardError(null);
    try {
      await onboardProperty(propertyId);
      await loadProperty(propertyId);
    } catch (err) {
      setOnboardError(extractErrorMessage(err));
    } finally {
      setOnboarding(false);
    }
  }

  return (
    <div>
      <PageHeader title="My Property" description="Live data from BQ — the only page here that isn't a mockup." />

      <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <label className="field" style={{ maxWidth: 240 }}>
          <span className="field__label">BQ property id</span>
          <input
            className="field__input"
            type="number"
            min={1}
            value={propertyIdInput}
            onChange={(e) => setPropertyIdInput(e.target.value)}
            placeholder="e.g. 1"
            required
          />
        </label>
        <button type="submit" className="button button--primary" disabled={loading}>
          {loading ? "Loading..." : "Load property"}
        </button>
      </form>

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
