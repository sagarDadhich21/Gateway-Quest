import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { fieldOwnershipRules } from "../../mockData/eq";
import { settings } from "../../mockData/core";

export function FieldOwnership() {
  return (
    <div>
      <PageHeader
        title="Field Ownership"
        description="Which system owns each ARI field, and when Gateway Quest holds it back"
      />
      <MockDataNotice />

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, lineHeight: 1.7, fontSize: 13 }}>
          This is the contract between the two systems. <strong>Enterprise Quest (EQ)</strong> owns every rate,
          availability and restriction value — Gateway Quest never edits, overrides or rejects it. It can only{" "}
          <strong>hold</strong> a row back when Channex would technically reject it (missing mapping, missing
          onboarding, an invalid value), and forwards everything else exactly as received.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>ARI field</th>
              <th>Owner</th>
              <th>Gateway Quest behaviour</th>
            </tr>
          </thead>
          <tbody>
            {fieldOwnershipRules.map(([field, owner, behaviour]) => (
              <tr key={field}>
                <td><strong>{field}</strong></td>
                <td>{owner}</td>
                <td className="muted">{behaviour}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-head-row">
          <div>
            <h3 style={{ margin: 0, fontSize: 14.5, color: "var(--primary)" }}>Technical guards</h3>
            <div className="muted" style={{ fontSize: 12 }}>Safety checks before forwarding — not editorial decisions</div>
          </div>
        </div>
        <dl className="property-detail-list" style={{ gridTemplateColumns: "220px 1fr" }}>
          <div className="property-detail-list__row"><dt>Rate must be positive</dt><dd>Always on — Channex rejects a rate of zero or less</dd></div>
          <div className="property-detail-list__row"><dt>Mapping required</dt><dd>Always on — a row with no Channex ID is held, never pushed</dd></div>
          <div className="property-detail-list__row"><dt>Occupancy check</dt><dd>Always on — a rate plan cannot exceed its room type's occupancy</dd></div>
          <div className="property-detail-list__row"><dt>Oversell guard</dt><dd>{settings.availabilityOversellGuard ? "On — block availability above physical room count" : "Off"}</dd></div>
          <div className="property-detail-list__row"><dt>Nightly full refresh</dt><dd>{settings.nightlyFullRefresh ? "On — full ARI resend per property each night" : "Off"}</dd></div>
          <div className="property-detail-list__row"><dt>Batch window</dt><dd>{settings.batchWindowSec} seconds per property</dd></div>
        </dl>
      </div>
    </div>
  );
}
