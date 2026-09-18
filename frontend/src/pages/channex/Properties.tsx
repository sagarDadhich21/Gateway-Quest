import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";
import {
  ChannexPropertyRow,
  channexProperties,
  channexRatePlans,
  channexRoomTypes,
  otaChannels,
} from "../../mockData/channexMiddleware";

function propertyStats(pid: string) {
  const roomTypes = channexRoomTypes.filter((r) => r.pid === pid);
  const ratePlans = channexRatePlans.filter((r) => r.pid === pid);
  const channels = otaChannels.filter((c) => c.pid === pid);
  return {
    roomTypes,
    ratePlans,
    channels,
    totalRooms: roomTypes.reduce((a, r) => a + r.count, 0),
    activeChannels: channels.filter((c) => c.status === "Active").length,
  };
}

export function ChannexProperties() {
  const [rows, setRows] = useState<ChannexPropertyRow[]>(channexProperties);
  const { showModal, confirm, closeModal } = useModal();
  const toast = useToast();

  function updateRow(id: string, patch: Partial<ChannexPropertyRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function openDetails(p: ChannexPropertyRow) {
    const s = propertyStats(p.id);
    showModal({
      title: p.name,
      wide: true,
      body: (
        <>
          <div className="section-title" style={{ marginTop: 0 }}>Overview</div>
          <div className="kv"><span className="k">Property code</span><span className="mono">{p.eqCode}</span></div>
          <div className="kv"><span className="k">Country / time zone</span><span>{p.country} · {p.timeZone}</span></div>
          <div className="kv"><span className="k">Currency</span><span>{p.currency}</span></div>
          <div className="kv"><span className="k">Channex property_id</span><span className="mono small">{p.cxId ?? "— not onboarded —"}</span></div>
          <div className="kv"><span className="k">Sync frequency</span><span>{p.syncFrequency}</span></div>
          <div className="kv"><span className="k">Reservation sync mode</span><span>{p.reservationSyncMode}</span></div>

          <div className="section-title">Room types ({s.roomTypes.length} · {s.totalRooms} rooms total)</div>
          {s.roomTypes.length ? (
            <table className="data-table">
              <thead><tr><th>Room type</th><th>Occupancy</th><th>Rooms</th><th>Status</th></tr></thead>
              <tbody>
                {s.roomTypes.map((r) => (
                  <tr key={r.id}>
                    <td>{r.eqName}</td><td>{r.occ}</td><td>{r.count}</td>
                    <td>{r.mapped ? <Pill label="Mapped" tone="success" /> : <Pill label="Unmapped" tone="error" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="muted small">No room types yet.</div>}

          <div className="section-title">Rate plans ({s.ratePlans.length})</div>
          {s.ratePlans.length ? (
            <table className="data-table">
              <thead><tr><th>Rate plan</th><th>sell_mode</th><th>Occupancy</th><th>Status</th></tr></thead>
              <tbody>
                {s.ratePlans.map((r) => (
                  <tr key={r.id}>
                    <td>{r.eqName}</td><td className="mono small">{r.sellMode}</td><td>{r.occ}</td>
                    <td>{r.mapped ? <Pill label="Mapped" tone="success" /> : <Pill label="Unmapped" tone="error" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="muted small">No rate plans yet.</div>}

          <div className="section-title">OTA channels ({s.activeChannels} / {s.channels.length} active)</div>
          {s.channels.length ? (
            <table className="data-table">
              <thead><tr><th>Channel</th><th>Mapped rooms</th><th>Bookings (30d)</th><th>Status</th></tr></thead>
              <tbody>
                {s.channels.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td><td>{c.mappedRooms} / {c.totalRooms}</td><td>{c.bookings30d}</td>
                    <td><Pill label={c.status} tone={c.status === "Active" ? "success" : c.status === "Warning" ? "warning" : "neutral"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="muted small">No channels yet.</div>}
        </>
      ),
      foot: (
        <>
          <button type="button" className="button button--primary" onClick={() => { closeModal(); openSetup(p); }}>Edit setup</button>
          <button type="button" className="button button--ghost" onClick={closeModal}>Close</button>
        </>
      ),
    });
  }

  function openSetup(p: ChannexPropertyRow) {
    showModal({
      title: `Property setup — ${p.name}`,
      wide: true,
      body: (
        <>
          <div className="section-title" style={{ marginTop: 0 }}>Property information</div>
          <p className="muted small">
            Name, code, country, time zone, currency, default inventory, default rate plan, sync frequency and
            reservation sync mode are all edited here in the source app — condensed to a summary in this preview.
          </p>
          <div className="kv"><span className="k">Country</span><span>{p.country}</span></div>
          <div className="kv"><span className="k">Time zone</span><span>{p.timeZone}</span></div>
          <div className="kv"><span className="k">Currency</span><span>{p.currency}</span></div>
          <div className="kv"><span className="k">Sync frequency</span><span>{p.syncFrequency}</span></div>
          <div className="kv"><span className="k">Reservation sync mode</span><span>{p.reservationSyncMode}</span></div>
          <div className="mock-notice" style={{ marginTop: 14, marginBottom: 0 }}>
            These settings configure how Gateway Quest distributes {p.name} — they don&apos;t change any rate or
            availability value Enterprise Quest owns.
          </div>
        </>
      ),
      foot: (
        <>
          <button type="button" className="button button--ghost" onClick={closeModal}>Cancel</button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              closeModal();
              toast("Property setup saved");
            }}
          >
            Save setup
          </button>
        </>
      ),
    });
  }

  function onboard(p: ChannexPropertyRow) {
    confirm(
      `Onboard ${p.name} to Channex?`,
      "Gateway Quest will create the property on Channex, then you can create and map its room types and rate plans.",
      () => {
        const cxId = "f" + Math.random().toString(16).slice(2, 9) + "-onbd-4c2a-9f01-" + Math.random().toString(16).slice(2, 14);
        updateRow(p.id, { cxId, onboarded: true, active: true });
        toast(`${p.name} onboarded — now create its room types`);
      }
    );
  }

  function toggleActive(p: ChannexPropertyRow) {
    if (p.active) {
      confirm(
        `Deactivate ${p.name}?`,
        "Nothing will be distributed for this property until it is reactivated. Existing bookings still arrive.",
        () => {
          updateRow(p.id, { active: false });
          toast(`${p.name} deactivated`, "warn");
        },
        true
      );
    } else {
      updateRow(p.id, { active: true });
      toast(`${p.name} reactivated`);
    }
  }

  const columns: DataTableColumn<ChannexPropertyRow>[] = [
    { key: "name", label: "EQ property", render: (r) => <><strong>{r.name}</strong><div className="muted small">{r.country}</div></> },
    { key: "eqCode", label: "EQ code", render: (r) => <code>{r.eqCode}</code> },
    { key: "cxId", label: "Channex property_id", render: (r) => (r.cxId ? <span className="mono small">{r.cxId}</span> : <Pill label="not onboarded" tone="error" />) },
    { key: "roomTypes", label: "Room types", align: "right", render: (r) => propertyStats(r.id).roomTypes.length },
    { key: "ratePlans", label: "Rate plans", align: "right", render: (r) => propertyStats(r.id).ratePlans.length },
    { key: "channels", label: "Channels", align: "right", render: (r) => { const s = propertyStats(r.id); return `${s.activeChannels} / ${s.channels.length}`; } },
    { key: "active", label: "Status", render: (r) => (r.active ? <Pill label="Active" tone="success" /> : <Pill label="Inactive" tone="neutral" />) },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) => (
        <div className="row-actions">
          <button type="button" className="button button--ghost" onClick={() => openDetails(r)}>Details</button>
          <button type="button" className="button button--ghost" onClick={() => openSetup(r)}>Setup</button>
          {r.cxId ? (
            <>
              <Link className="button button--ghost" to="/mapping/room-types">Room mapping</Link>
              <Link className="button button--ghost" to="/mapping/rate-plans">Rate mapping</Link>
              <button
                type="button"
                className={"button " + (r.active ? "button--danger" : "button--primary")}
                onClick={() => toggleActive(r)}
              >
                {r.active ? "Deactivate" : "Reactivate"}
              </button>
            </>
          ) : (
            <button type="button" className="button button--primary" onClick={() => onboard(r)}>Onboard to Channex</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Channex Properties" description="EQ properties linked to Channex property_id" />
      <MockDataNotice />
      <div className="card" style={{ marginBottom: 16 }}>
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
      </div>
      <div className="card">
        <p className="muted small" style={{ margin: 0, lineHeight: 1.7 }}>
          A property must exist on the Channex side before any ARI can be pushed. Gateway Quest creates it through{" "}
          <span className="mono">POST /properties</span> and stores the returned <span className="mono">property_id</span>{" "}
          against the EQ property.
        </p>
      </div>
    </div>
  );
}
