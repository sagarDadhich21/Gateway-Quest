import { useEffect, useMemo, useState } from "react";
import { useIsSuperAdmin } from "../../auth/useIsSuperAdmin";
import { extractErrorMessage } from "../../api/client";
import { listApiLogs } from "../../api/gqApi";
import { ApiLogResponse } from "../../api/types";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pill, PillTone } from "../../components/Pill";
import { useModal } from "../../components/modal/ModalContext";
import { formatDateTime } from "../bookings/revisionCells";

/** Compact one-line preview for a table cell - full value is shown in the detail modal on click. */
function previewOf(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const json = JSON.stringify(value);
  return json.length > 50 ? `${json.slice(0, 50)}…` : json;
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <p className="muted small">—</p>;
  }
  return (
    <pre
      className="mono small"
      style={{
        margin: 0,
        padding: "10px 12px",
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        maxHeight: 320,
        overflow: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

type Severity = "success" | "warning" | "error" | "other";
type SeverityFilter = "all" | Severity;

function severityOf(status: number): Severity {
  if (status >= 500) return "error";
  if (status >= 400) return "warning";
  if (status >= 200 && status < 300) return "success";
  return "other";
}

function statusTone(status: number): PillTone {
  const severity = severityOf(status);
  if (severity === "error") return "error";
  if (severity === "warning") return "warning";
  if (severity === "success") return "success";
  return "neutral";
}

/** gq_api_log - every outbound call GQ makes to Channex (channex.client.ts). Never includes the API key or request/response bodies. Not property-scoped, admin only. */
export function ApiLogs() {
  const isSuperAdmin = useIsSuperAdmin();
  const [rows, setRows] = useState<ApiLogResponse[]>([]);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showModal, closeModal } = useModal();

  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError(null);
    listApiLogs()
      .then(setRows)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isSuperAdmin]);

  const counts = useMemo(() => {
    const result: Record<Severity, number> = { success: 0, warning: 0, error: 0, other: 0 };
    for (const row of rows) {
      result[severityOf(row.httpStatus)] += 1;
    }
    return result;
  }, [rows]);

  const visibleRows = severityFilter === "all" ? rows : rows.filter((r) => severityOf(r.httpStatus) === severityFilter);

  function showDetail(log: ApiLogResponse) {
    showModal({
      title: `${log.method} ${log.endpoint}`,
      wide: true,
      body: (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>
            <Pill label={String(log.httpStatus)} tone={statusTone(log.httpStatus)} /> · {log.latencyMs} ms ·{" "}
            {formatDateTime(log.createdAt)}
          </p>
          <h4 style={{ marginBottom: 8 }}>Request</h4>
          <JsonBlock value={log.requestBody} />
          <h4 style={{ marginTop: 16, marginBottom: 8 }}>Response</h4>
          <JsonBlock value={log.responseBody} />
        </>
      ),
      foot: (
        <button type="button" className="button button--ghost" onClick={closeModal}>
          Close
        </button>
      ),
    });
  }

  const columns: DataTableColumn<ApiLogResponse>[] = [
    { key: "method", label: "Method", render: (l) => <code>{l.method}</code> },
    { key: "endpoint", label: "Endpoint", render: (l) => <span className="mono small">{l.endpoint}</span> },
    { key: "status", label: "Status", render: (l) => <Pill label={String(l.httpStatus)} tone={statusTone(l.httpStatus)} /> },
    { key: "latency", label: "Latency", align: "right", render: (l) => `${l.latencyMs} ms` },
    {
      key: "request",
      label: "Request",
      render: (l) => (
        <button type="button" className="button button--ghost" style={{ padding: "4px 10px" }} onClick={() => showDetail(l)}>
          <span className="mono small">{previewOf(l.requestBody)}</span>
        </button>
      ),
    },
    {
      key: "response",
      label: "Response",
      render: (l) => (
        <button type="button" className="button button--ghost" style={{ padding: "4px 10px" }} onClick={() => showDetail(l)}>
          <span className="mono small">{previewOf(l.responseBody)}</span>
        </button>
      ),
    },
    { key: "created", label: "Called at", render: (l) => formatDateTime(l.createdAt) },
  ];

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader title="API Logs" description="Every request Gateway Quest makes to Channex" />
        <div className="card">
          <p className="muted">This page requires the Super_Admin role — your account doesn't have it.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="API Logs" description="Every request Gateway Quest makes to Channex" />
      {error && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">{error}</p>
        </div>
      )}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="segmented">
          <button
            type="button"
            className={"segmented__btn" + (severityFilter === "all" ? " segmented__btn--active" : "")}
            onClick={() => setSeverityFilter("all")}
          >
            All ({rows.length})
          </button>
          <button
            type="button"
            className={"segmented__btn" + (severityFilter === "warning" ? " segmented__btn--active" : "")}
            onClick={() => setSeverityFilter("warning")}
          >
            Warnings ({counts.warning})
          </button>
          <button
            type="button"
            className={"segmented__btn" + (severityFilter === "error" ? " segmented__btn--active" : "")}
            onClick={() => setSeverityFilter("error")}
          >
            Errors ({counts.error})
          </button>
          <button
            type="button"
            className={"segmented__btn" + (severityFilter === "success" ? " segmented__btn--active" : "")}
            onClick={() => setSeverityFilter("success")}
          >
            Success ({counts.success})
          </button>
        </div>
      </div>
      <div className="card">
        <DataTable
          columns={columns}
          rows={visibleRows}
          getRowKey={(l) => l.id}
          emptyMessage={
            loading
              ? "Loading…"
              : rows.length === 0
                ? "No API calls recorded yet."
                : "Nothing in this category."
          }
        />
      </div>
    </div>
  );
}
