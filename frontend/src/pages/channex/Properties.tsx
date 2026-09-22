import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentPropertyId } from "../../auth/useCurrentProperty";
import { extractErrorMessage } from "../../api/client";
import { getProperty, getRoomTypes, listRatePlans, onboardProperty } from "../../api/gqApi";
import { PropertyResponse, RatePlan, RoomTypeSummary } from "../../api/types";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";

interface Row {
  property: PropertyResponse;
  roomTypes: RoomTypeSummary[];
  ratePlans: RatePlan[];
}

/**
 * GQ is scoped to the logged-in user's one property (see PropertyPage.tsx) - there is
 * no multi-property list endpoint to show a table of several properties. This shows
 * that same single real property as a one-row table, since the page's nav slot and
 * column layout were built around a table.
 */
export function ChannexProperties() {
  const propertyId = useCurrentPropertyId();
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showModal, closeModal } = useModal();
  const toast = useToast();

  async function load() {
    if (propertyId === null) return;
    setLoading(true);
    setError(null);
    try {
      const [property, roomTypes, ratePlans] = await Promise.all([
        getProperty(propertyId),
        getRoomTypes(propertyId),
        listRatePlans(propertyId),
      ]);
      setRow({ property, roomTypes, ratePlans });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  async function handleOnboard() {
    if (propertyId === null) return;
    setOnboarding(true);
    try {
      await onboardProperty(propertyId);
      toast("Property onboarded to Channex.");
      await load();
    } catch (err) {
      toast(extractErrorMessage(err), "err");
    } finally {
      setOnboarding(false);
    }
  }

  function openDetails(r: Row) {
    const onboardedRoomTypes = r.roomTypes.filter((t) => t.channex.onboarded).length;
    const onboardedRatePlans = r.ratePlans.filter((p) => p.channex.onboarded).length;

    showModal({
      title: r.property.name,
      wide: true,
      body: (
        <>
          <div className="section-title" style={{ marginTop: 0 }}>Overview</div>
          <div className="kv"><span className="k">City / country</span><span>{r.property.city} · {r.property.country ?? "—"}</span></div>
          <div className="kv"><span className="k">Currency</span><span>{r.property.currency ?? "—"}</span></div>
          <div className="kv"><span className="k">Time zone</span><span>{r.property.timeZone ?? "—"}</span></div>
          <div className="kv"><span className="k">Channex property_id</span><span className="mono small">{r.property.channex.propertyId ?? "— not onboarded —"}</span></div>

          <div className="section-title">Room types ({onboardedRoomTypes} / {r.roomTypes.length} onboarded)</div>
          {r.roomTypes.length ? (
            <table className="data-table">
              <thead><tr><th>Room type</th><th>Occupancy</th><th>Rooms</th><th>Status</th></tr></thead>
              <tbody>
                {r.roomTypes.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td><td>{t.maxOccupancy}</td><td>{t.totalRooms}</td>
                    <td>{t.channex.onboarded ? <Pill label="Onboarded" tone="success" /> : <Pill label="Not onboarded" tone="warning" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="muted small">No room types yet.</div>}

          <div className="section-title">Rate plans ({onboardedRatePlans} / {r.ratePlans.length} onboarded)</div>
          {r.ratePlans.length ? (
            <table className="data-table">
              <thead><tr><th>Rate plan</th><th>sell_mode</th><th>Status</th></tr></thead>
              <tbody>
                {r.ratePlans.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td><td className="mono small">{p.sellMode}</td>
                    <td>{p.channex.onboarded ? <Pill label="Onboarded" tone="success" /> : <Pill label="Not onboarded" tone="warning" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="muted small">No rate plans yet.</div>}
        </>
      ),
      foot: <button type="button" className="button button--ghost" onClick={closeModal}>Close</button>,
    });
  }

  const columns: DataTableColumn<Row>[] = [
    { key: "name", label: "Property", render: (r) => <><strong>{r.property.name}</strong><div className="muted small">{r.property.country ?? "—"}</div></> },
    { key: "cxId", label: "Channex property_id", render: (r) => (r.property.channex.propertyId ? <span className="mono small">{r.property.channex.propertyId}</span> : <Pill label="not onboarded" tone="error" />) },
    { key: "roomTypes", label: "Room types", align: "right", render: (r) => `${r.roomTypes.filter((t) => t.channex.onboarded).length} / ${r.roomTypes.length}` },
    { key: "ratePlans", label: "Rate plans", align: "right", render: (r) => `${r.ratePlans.filter((p) => p.channex.onboarded).length} / ${r.ratePlans.length}` },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) => (
        <div className="row-actions">
          <button type="button" className="button button--ghost" onClick={() => openDetails(r)}>Details</button>
          {r.property.channex.onboarded ? (
            <>
              <Link className="button button--ghost" to="/mapping/room-types">Room mapping</Link>
              <Link className="button button--ghost" to="/mapping/rate-plans">Rate mapping</Link>
            </>
          ) : (
            <button type="button" className="button button--primary" onClick={handleOnboard} disabled={onboarding}>
              {onboarding ? "Onboarding…" : "Onboard to Channex"}
            </button>
          )}
        </div>
      ),
    },
  ];

  if (propertyId === null) {
    return (
      <div>
        <PageHeader title="Channex Properties" description="EQ properties linked to Channex property_id" />
        <div className="card">
          <p className="muted">Your account has no assigned property, so there is nothing to load here.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Channex Properties" description="EQ properties linked to Channex property_id" />
      {error && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">{error}</p>
        </div>
      )}
      <div className="card">
        <DataTable
          columns={columns}
          rows={row ? [row] : []}
          getRowKey={(r) => String(r.property.id)}
          emptyMessage={loading ? "Loading…" : "No property found."}
        />
      </div>
    </div>
  );
}
