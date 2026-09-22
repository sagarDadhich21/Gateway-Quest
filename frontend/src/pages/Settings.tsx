import { useState } from "react";
import { NotAvailableNotice } from "../components/NotAvailableNotice";
import { PageHeader } from "../components/PageHeader";
import { Toggle } from "../components/Toggle";

export function Settings() {
  const [availabilityOversellGuard, setAvailabilityOversellGuard] = useState(true);
  const [nightlyFullRefresh, setNightlyFullRefresh] = useState(true);
  const [ackOnEqSuccess, setAckOnEqSuccess] = useState(true);
  const [batchWindowSec, setBatchWindowSec] = useState(45);
  const [dirty, setDirty] = useState(false);

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  return (
    <div>
      <PageHeader title="Settings" description="Pipeline guards, batching and acknowledgement behaviour" />
      <NotAvailableNotice />

      <div className="card settings-card">
        <div className="settings-row">
          <div>
            <div className="settings-row__label">Availability oversell guard</div>
            <div className="muted">Block availability pushes that exceed physical room count.</div>
          </div>
          <Toggle
            on={availabilityOversellGuard}
            onChange={markDirty(setAvailabilityOversellGuard)}
            label="Availability oversell guard"
          />
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row__label">Nightly full ARI refresh</div>
            <div className="muted">Resend a complete ARI picture per property every night.</div>
          </div>
          <Toggle on={nightlyFullRefresh} onChange={markDirty(setNightlyFullRefresh)} label="Nightly full ARI refresh" />
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row__label">Acknowledge only after EQ stores booking</div>
            <div className="muted">Never ack a Channex booking before it is durably stored.</div>
          </div>
          <Toggle on={ackOnEqSuccess} onChange={markDirty(setAckOnEqSuccess)} label="Acknowledge only after EQ stores booking" />
        </div>

        <label className="field settings-row settings-row--input">
          <div>
            <div className="settings-row__label">Batch window (seconds)</div>
            <div className="muted">How long to collect changes per property before pushing.</div>
          </div>
          <input
            className="field__input"
            type="number"
            min={5}
            max={300}
            value={batchWindowSec}
            onChange={(e) => markDirty(setBatchWindowSec)(Number(e.target.value))}
            style={{ maxWidth: 100 }}
          />
        </label>

        {dirty && (
          <div className="settings-card__savebar">
            <span className="muted">Unsaved changes</span>
            <button type="button" className="button button--ghost" onClick={() => setDirty(false)}>
              Discard
            </button>
            <button type="button" className="button button--primary" onClick={() => setDirty(false)}>
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
