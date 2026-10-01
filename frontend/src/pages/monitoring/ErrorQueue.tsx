import { useEffect, useState } from "react";
import { useIsSuperAdmin } from "../../auth/useIsSuperAdmin";
import { extractErrorMessage } from "../../api/client";
import { listErrorQueue } from "../../api/gqApi";
import { ErrorQueueResponse } from "../../api/types";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { formatDateTime } from "../bookings/revisionCells";

/**
 * gq_error_queue - currently written only from the webhook's fire-and-forget async
 * processing catch block (booking.routes.ts) - the one place an error would otherwise
 * only exist in stdout logs. Not property-scoped, admin only.
 */
export function ErrorQueue() {
  const isSuperAdmin = useIsSuperAdmin();
  const [rows, setRows] = useState<ErrorQueueResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError(null);
    listErrorQueue()
      .then(setRows)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isSuperAdmin]);

  const columns: DataTableColumn<ErrorQueueResponse>[] = [
    { key: "source", label: "Source", render: (e) => <code>{e.source}</code> },
    {
      key: "message",
      label: "Error",
      render: (e) => (
        <div className="revision-issue-cell" title={e.errorMessage}>
          <span className="revision-issue-cell__reason">{e.errorMessage}</span>
        </div>
      ),
    },
    {
      key: "payload",
      label: "Payload",
      render: (e) => (
        <span className="mono small" title={JSON.stringify(e.payload)}>
          {JSON.stringify(e.payload).slice(0, 60)}
          {JSON.stringify(e.payload).length > 60 ? "…" : ""}
        </span>
      ),
    },
    { key: "retries", label: "Retries", align: "right", render: (e) => e.retryCount },
    { key: "created", label: "Created", render: (e) => formatDateTime(e.createdAt) },
  ];

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader title="Error Queue" description="Failed pushes, rate limits and validation rejections" />
        <div className="card">
          <p className="muted">This page requires the Super_Admin role — your account doesn't have it.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Error Queue" description="Failed pushes, rate limits and validation rejections" />
      {error && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">{error}</p>
        </div>
      )}
      <div className="card">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(e) => e.id}
          emptyMessage={loading ? "Loading…" : "No queued errors — nothing here needs attention."}
        />
      </div>
    </div>
  );
}
