import { useState } from "react";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MapPicker } from "../../components/modal/MapPicker";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";
import { ChannexRatePlanRow, channexRatePlans, propName } from "../../mockData/channexMiddleware";
import { ratePlanPoolFor } from "../../mockData/channexPool";

export function RatePlanMapping() {
  const [rows, setRows] = useState<ChannexRatePlanRow[]>(channexRatePlans);
  const { showModal, closeModal } = useModal();
  const toast = useToast();

  function openMap(row: ChannexRatePlanRow) {
    const pool = ratePlanPoolFor(row.pid);
    let picked = pool.find((o) => o.title === row.cxTitle) ?? null;

    function rerender() {
      showModal({
        title: `Map ${row.eqName}`,
        wide: true,
        body: (
          <>
            <div className="section-title" style={{ marginTop: 0 }}>Enterprise Quest (EQ) side</div>
            <div className="kv"><span className="k">Property</span><span>{propName(row.pid)}</span></div>
            <div className="kv"><span className="k">sell_mode</span><span className="mono">{row.sellMode}</span></div>
            <div className="kv"><span className="k">Occupancy</span><span>{row.occ}</span></div>
            <div className="section-title">Channex target</div>
            <MapPicker pool={pool} currentId={picked?.id ?? null} onPick={(o) => { picked = o; rerender(); }} placeholder="Search Channex rate plans…" />
          </>
        ),
        foot: (
          <>
            <button type="button" className="button button--ghost" onClick={closeModal}>Cancel</button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                if (!picked) return;
                setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, cxId: picked!.id, cxTitle: picked!.title, mapped: true } : r)));
                closeModal();
                toast(`${row.eqName} mapped to ${picked.title}`);
              }}
            >
              Save mapping
            </button>
          </>
        ),
      });
    }

    rerender();
  }

  function autoMap() {
    let done = 0;
    let missed = 0;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    setRows((prev) =>
      prev.map((r) => {
        if (r.mapped) return r;
        const pool = ratePlanPoolFor(r.pid);
        const target = norm(r.eqName);
        const hit = pool.find((o) => norm(o.title) === target) ?? pool.find((o) => norm(o.title).includes(target) || target.includes(norm(o.title)));
        if (hit) {
          done++;
          return { ...r, cxId: hit.id, cxTitle: hit.title, mapped: true };
        }
        missed++;
        return r;
      })
    );
    if (done) toast(`Auto-mapped ${done} row(s) by name`);
    if (missed) toast(`${missed} row(s) had no confident match — map those by hand.`, "warn");
    if (!done && !missed) toast("Everything is already mapped.");
  }

  function validate() {
    const unmapped = rows.filter((r) => !r.mapped);
    const seen = new Map<string, ChannexRatePlanRow>();
    const dupes: ChannexRatePlanRow[] = [];
    rows.forEach((r) => {
      if (r.cxId) {
        if (seen.has(r.cxId)) dupes.push(r);
        else seen.set(r.cxId, r);
      }
    });

    showModal({
      title: "Mapping validation",
      wide: true,
      body:
        unmapped.length === 0 && dupes.length === 0 ? (
          <div className="mock-notice" style={{ background: "#e8f9ef", borderColor: "var(--success)", color: "#0a6b39" }}>
            Mapping is complete and unambiguous. Every row can be pushed to Channex.
          </div>
        ) : (
          <>
            {unmapped.length > 0 && (
              <>
                <div className="section-title" style={{ marginTop: 0 }}>Unmapped ({unmapped.length})</div>
                <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.8, margin: 0 }}>
                  {unmapped.map((r) => <li key={r.id}>{r.eqName} — {propName(r.pid)}</li>)}
                </ul>
              </>
            )}
            {dupes.length > 0 && (
              <>
                <div className="section-title">Duplicate targets ({dupes.length})</div>
                <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.8, margin: 0 }}>
                  {dupes.map((r) => <li key={r.id}>{r.eqName} collides with {seen.get(r.cxId as string)?.eqName}</li>)}
                </ul>
              </>
            )}
            <div className="mock-notice" style={{ marginTop: 14, marginBottom: 0 }}>
              Rows listed above are excluded from every push until they are fixed.
            </div>
          </>
        ),
    });
  }

  const columns: DataTableColumn<ChannexRatePlanRow>[] = [
    { key: "pid", label: "Property", render: (r) => propName(r.pid) },
    { key: "eqName", label: "EQ rate plan", render: (r) => r.eqName },
    { key: "cxTitle", label: "Channex target", render: (r) => r.cxTitle ?? <span className="muted">—</span> },
    { key: "status", label: "Status", render: (r) => (r.mapped ? <Pill label="Mapped" tone="success" /> : <Pill label="Unmapped" tone="warning" />) },
    { key: "actions", label: "", align: "right", render: (r) => <button type="button" className="button button--ghost" onClick={() => openMap(r)}>Map</button> },
  ];

  return (
    <div>
      <PageHeader
        title="Rate Plan Mapping"
        description="EQ rate plan → Channex rate_plan_id"
        actions={
          <>
            <button type="button" className="button button--ghost" onClick={validate}>Validate</button>
            <button type="button" className="button button--primary" onClick={autoMap}>Auto-map by name</button>
          </>
        }
      />
      <MockDataNotice />
      <div className="card">
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
      </div>
    </div>
  );
}
