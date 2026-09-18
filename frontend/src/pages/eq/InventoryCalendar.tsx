import { useMemo, useState } from "react";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { channexProperties, channexRatePlans, channexRoomTypes } from "../../mockData/channexMiddleware";
import { money } from "../../lib/format";

const CAL_DAYS = 14;
const CAL_START = new Date(2026, 7, 19); // 2026-08-19, matching the source's sample dates

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

/** Mirrors PAGES.inventorycal's per-day derivation (weekend rate * 1.18, availability decays cyclically) - this page has no dedicated mock array in the source, it's computed live from room types / rate plans, same here. */
export function InventoryCalendar() {
  const [propertyId, setPropertyId] = useState(channexProperties[0].id);
  const property = channexProperties.find((p) => p.id === propertyId)!;
  const roomTypes = channexRoomTypes.filter((rt) => rt.pid === propertyId);

  const days = useMemo(() => Array.from({ length: CAL_DAYS }, (_, i) => addDays(CAL_START, i)), []);

  return (
    <div>
      <PageHeader
        title="Inventory Calendar"
        description="Read-only — rate and availability for every room type, by day"
      />
      <MockDataNotice />

      <div className="card" style={{ marginBottom: 16 }}>
        <label className="field" style={{ maxWidth: 260, marginBottom: 0 }}>
          <span className="field__label">Property</span>
          <select className="field__input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            {channexProperties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="card">
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: 190 }}>Room type</th>
                {days.map((d) => {
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <th key={d.toISOString()} style={{ textAlign: "center", color: weekend ? "var(--purple)" : undefined }}>
                      {d.toLocaleDateString("en-US", { weekday: "short" })}
                      <div className="muted" style={{ fontWeight: 400 }}>{d.getDate()}/{d.getMonth() + 1}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((rt) => {
                const rp = channexRatePlans.find((r) => r.rtId === rt.id && r.eqName.includes("Best Available")) ??
                  channexRatePlans.filter((r) => r.rtId === rt.id)[0] ?? null;
                const baseAvail = rt.count;
                const baseRate = 450000; // sample base rate in minor units when no rate row is loaded for this room type
                return (
                  <tr key={rt.id}>
                    <td>
                      <strong>{rt.eqName}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {rp ? `${rp.eqName} · ${rt.count} rooms` : `No rate plan · ${rt.count} rooms`}
                      </div>
                      {rp && !rp.mapped && <Pill label="unmapped" tone="error" />}
                    </td>
                    {days.map((d, i) => {
                      const weekend = d.getDay() === 0 || d.getDay() === 6;
                      const avail = Math.max(0, baseAvail - (i % (baseAvail + 2)));
                      const rate = Math.round(baseRate * (weekend ? 1.18 : 1));
                      return (
                        <td
                          key={d.toISOString()}
                          style={{ textAlign: "center", background: weekend ? "#fbf7ff" : undefined }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 12.5 }}>{money(rate, property.currency)}</div>
                          <div style={{ fontSize: 12, marginTop: 2, color: avail === 0 ? "var(--danger)" : "var(--text-soft)" }}>
                            {avail} left
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
