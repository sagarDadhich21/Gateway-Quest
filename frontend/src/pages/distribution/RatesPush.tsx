import { useState } from "react";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill, PillTone } from "../../components/Pill";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";
import { propById, propName, ratePlanById } from "../../mockData/channexMiddleware";
import { RatePushRow, ratePushRows } from "../../mockData/distribution";
import { money } from "../../lib/format";

const STATUS_TONE: Record<RatePushRow["status"], PillTone> = {
  "In sync": "success",
  "Pending push": "warning",
  Blocked: "error",
  Rejected: "error",
};

export function RatesPush() {
  const [rows, setRows] = useState<RatePushRow[]>(ratePushRows);
  const { showModal, confirm, closeModal } = useModal();
  const toast = useToast();

  const ready = rows.filter((r) => r.status === "Pending push");

  function previewBatch() {
    const payload = {
      values: ready.map((r) => ({
        property_id: propById(r.pid)?.cxId ?? "<not onboarded>",
        rate_plan_id: ratePlanById(r.rpId)?.cxId ?? "<not mapped>",
        date_from: r.dateFrom,
        date_to: r.dateTo,
        rate: r.eqValue,
      })),
    };
    showModal({
      title: "Preview batch — POST /restrictions",
      wide: true,
      body: (
        <pre className="mono small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {JSON.stringify(payload, null, 2)}
        </pre>
      ),
      foot: <button type="button" className="button button--ghost" onClick={closeModal}>Close</button>,
    });
  }

  function pushAll() {
    if (!ready.length) {
      toast("Nothing ready to push.", "warn");
      return;
    }
    confirm(
      `Push ${ready.length} row(s) to Channex?`,
      "This sends every ready row straight to Channex, which fans it out to every mapped OTA channel immediately.",
      () => {
        setRows((prev) => prev.map((r) => (r.status === "Pending push" ? { ...r, status: "In sync", cxValue: r.eqValue } : r)));
        toast(`Pushed ${ready.length} row(s) to Channex`);
      }
    );
  }

  const columns: DataTableColumn<RatePushRow>[] = [
    { key: "pid", label: "Property", render: (r) => propName(r.pid) },
    { key: "rpId", label: "Rate plan", render: (r) => ratePlanById(r.rpId)?.eqName ?? r.rpId },
    { key: "dateFrom", label: "From", render: (r) => r.dateFrom },
    { key: "dateTo", label: "To", render: (r) => r.dateTo },
    { key: "eqValue", label: "EQ rate", align: "right", render: (r) => money(r.eqValue, propById(r.pid)?.currency) },
    { key: "cxValue", label: "Channex rate", align: "right", render: (r) => money(r.cxValue, propById(r.pid)?.currency) },
    { key: "status", label: "Status", render: (r) => <Pill label={r.status} tone={STATUS_TONE[r.status]} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Rates Push"
        description="POST /restrictions — rate values at rate-plan level"
        actions={
          <>
            <button type="button" className="button button--ghost" onClick={previewBatch}>Preview batch</button>
            <button type="button" className="button button--primary" onClick={pushAll}>Push all ready ({ready.length})</button>
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
