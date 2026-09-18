import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill, PillTone } from "../../components/Pill";
import { Tabs } from "../../components/Tabs";
import { useModal } from "../../components/modal/ModalContext";
import { propById, propName } from "../../mockData/channexMiddleware";
import { EQ } from "../../mockData/core";
import { InboundAriMessage, inboundAriMessages } from "../../mockData/eq";
import { reviewQueueItems } from "../../mockData/ariStatus";

const STATUS_TONE: Record<InboundAriMessage["status"], PillTone> = {
  Applied: "success",
  "Pending review": "warning",
  Rejected: "error",
  "Partially applied": "warning",
};

const KIND_TONE: Record<InboundAriMessage["kind"], PillTone> = {
  availability: "info",
  rate: "purple",
  restriction: "info",
};

const FILTERS = ["All", "Pending review", "Applied", "Partially applied", "Rejected"];

export function InboundAriFeed() {
  const [filter, setFilter] = useState("All");
  const { showModal, closeModal } = useModal();
  const navigate = useNavigate();

  const filtered = useMemo(
    () => (filter === "All" ? inboundAriMessages : inboundAriMessages.filter((m) => m.status === filter)),
    [filter]
  );

  function inspect(m: InboundAriMessage) {
    const property = propById(m.pid);
    const items = reviewQueueItems.filter((r) => r.msg === m.id);
    const endpoint = m.kind === "availability" ? "/availability" : "/restrictions";

    showModal({
      title: `Inbound message ${m.id}`,
      wide: true,
      body: (
        <>
          <div className="kv"><span className="k">Message ID</span><span className="mono">{m.id}</span></div>
          <div className="kv"><span className="k">Received</span><span>{m.at}</span></div>
          <div className="kv"><span className="k">Property</span><span>{propName(m.pid)} ({property?.eqCode})</span></div>
          <div className="kv"><span className="k">Channex property_id</span><span className="mono small">{property?.cxId ?? "— not onboarded"}</span></div>
          <div className="kv"><span className="k">Payload type</span><span>{m.kind}</span></div>
          <div className="kv"><span className="k">Rows</span><span>{m.rows}</span></div>
          <div className="kv"><span className="k">Target endpoint</span><span className="mono">POST {endpoint}</span></div>
          <div className="kv"><span className="k">Status</span><span><Pill label={m.status} tone={STATUS_TONE[m.status]} /></span></div>

          {items.length > 0 && (
            <>
              <div className="section-title">Forwarding status from this message</div>
              <table className="data-table">
                <thead><tr><th>Item</th><th>Target</th><th>Field</th><th>Status</th></tr></thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.id}</td>
                      <td>{r.target}</td>
                      <td className="mono small">{r.field}</td>
                      <td><Pill label={r.decision} tone={r.decision === "Forwarded" ? "success" : r.decision === "Held" ? "error" : "warning"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {m.status === "Rejected" && (
            <div className="mock-notice" style={{ marginTop: 14, marginBottom: 0 }}>
              This message was rejected before reaching Channex. {m.note}
            </div>
          )}
        </>
      ),
      foot: (
        <>
          {items.length > 0 && (
            <button
              type="button"
              className="button button--primary"
              onClick={() => { closeModal(); navigate("/ari-status"); }}
            >
              View ARI status
            </button>
          )}
          <button type="button" className="button button--ghost" onClick={closeModal}>Close</button>
        </>
      ),
    });
  }

  const columns: DataTableColumn<InboundAriMessage>[] = [
    { key: "id", label: "Message ID", render: (r) => <code>{r.id}</code> },
    { key: "at", label: "Received", render: (r) => <span className="muted">{r.at}</span> },
    { key: "pid", label: "Property", render: (r) => propName(r.pid) },
    { key: "kind", label: "Type", render: (r) => <Pill label={r.kind} tone={KIND_TONE[r.kind]} /> },
    { key: "rows", label: "Rows", align: "right", render: (r) => r.rows },
    { key: "note", label: "Detail", render: (r) => <span className="muted">{r.note}</span> },
    { key: "status", label: "Status", render: (r) => <Pill label={r.status} tone={STATUS_TONE[r.status]} /> },
    { key: "actions", label: "", align: "right", render: (r) => <button type="button" className="button button--ghost" onClick={() => inspect(r)}>Inspect</button> },
  ];

  return (
    <div>
      <PageHeader title="Inbound ARI Feed" description="Rates, availability and restrictions pushed from Enterprise Quest (EQ)" />
      <MockDataNotice />

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
          <div>
            <div className="stat-tile__label">Source system</div>
            <div style={{ fontWeight: 700 }}>{EQ.name}</div>
          </div>
          <div>
            <div className="stat-tile__label">Delivery mode</div>
            <div style={{ fontWeight: 700 }}>{EQ.mode}</div>
          </div>
          <div>
            <div className="stat-tile__label">Last message</div>
            <div style={{ fontWeight: 700 }}>{EQ.lastMessage}</div>
          </div>
          <div>
            <div className="stat-tile__label">Connection</div>
            <Pill label={EQ.status} tone="success" />
          </div>
        </div>
        <div className="muted" style={{ marginTop: 12, fontSize: 12.5 }}>
          EQ owns the original pricing, rates and availability. Gateway Quest never edits data at source — it decides what is allowed through to Channex.
        </div>
      </div>

      <Tabs options={FILTERS.map((f) => ({ label: f, value: f }))} active={filter} onChange={setFilter} />

      <div className="card">
        <DataTable columns={columns} rows={filtered} getRowKey={(r) => r.id} emptyMessage="No inbound messages match this filter." />
      </div>
    </div>
  );
}
