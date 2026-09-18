import { useState } from "react";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill, PillTone } from "../../components/Pill";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";
import { propName } from "../../mockData/channexMiddleware";
import { ErrorQueueRow, errorQueueRows } from "../../mockData/monitoring";

const STATUS_TONE: Record<ErrorQueueRow["status"], PillTone> = {
  Pending: "warning",
  Resolved: "success",
  Dismissed: "neutral",
};

export function ErrorQueue() {
  const [rows, setRows] = useState(errorQueueRows);
  const { confirm } = useModal();
  const toast = useToast();

  function retry(r: ErrorQueueRow) {
    setRows((prev) => prev.map((row) => (row.id === r.id ? { ...row, status: "Resolved" as const, retries: row.retries + 1 } : row)));
    toast(`Retried — ${r.kind.toLowerCase()} cleared for ${propName(r.pid)}`);
  }

  function dismiss(r: ErrorQueueRow) {
    confirm(
      "Dismiss this error?",
      "It disappears from the queue without being retried. The underlying rows stay unsynced.",
      () => {
        setRows((prev) => prev.map((row) => (row.id === r.id ? { ...row, status: "Dismissed" as const } : row)));
        toast("Error dismissed — underlying rows remain unsynced", "warn");
      },
      true
    );
  }

  const columns: DataTableColumn<ErrorQueueRow>[] = [
    { key: "id", label: "Error", render: (r) => <code>{r.id}</code> },
    { key: "kind", label: "Type", render: (r) => <Pill label={r.kind} tone={r.kind.includes("429") ? "warning" : "error"} /> },
    { key: "pid", label: "Property", render: (r) => propName(r.pid) },
    { key: "detail", label: "Detail", render: (r) => <span className="muted">{r.detail}</span> },
    { key: "retries", label: "Retries", align: "right", render: (r) => r.retries },
    { key: "status", label: "Status", render: (r) => <Pill label={r.status} tone={STATUS_TONE[r.status]} /> },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) =>
        r.status === "Pending" ? (
          <div className="row-actions">
            <button type="button" className="button button--ghost" onClick={() => retry(r)}>Retry</button>
            <button type="button" className="button button--ghost" onClick={() => dismiss(r)}>Dismiss</button>
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Error Queue" description="Failed pushes, rate limits and validation rejections" />
      <MockDataNotice />
      <div className="card">
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
      </div>
    </div>
  );
}
