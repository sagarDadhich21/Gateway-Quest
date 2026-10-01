import { useEffect, useState } from "react";
import { useIsSuperAdmin } from "../../auth/useIsSuperAdmin";
import { extractErrorMessage } from "../../api/client";
import { listWebhookLog } from "../../api/gqApi";
import { WebhookLogResponse } from "../../api/types";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { formatDateTime } from "../bookings/revisionCells";

/**
 * gq_webhook_log - one row per accepted POST /webhooks/channex call (after the
 * shared-secret check passes). "Attempt" is GQ's own count of how many times this same
 * ref (Channex booking/revision id) has been seen - Channex's payload carries no retry
 * number of its own. Not property-scoped, admin only.
 */
export function WebhookLog() {
  const isSuperAdmin = useIsSuperAdmin();
  const [rows, setRows] = useState<WebhookLogResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError(null);
    listWebhookLog()
      .then(setRows)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isSuperAdmin]);

  const columns: DataTableColumn<WebhookLogResponse>[] = [
    { key: "event", label: "Event", render: (w) => <code>{w.event}</code> },
    { key: "ref", label: "Reference", render: (w) => <span className="mono small">{w.ref}</span> },
    { key: "attempt", label: "Attempt", align: "right", render: (w) => w.attempt },
    {
      key: "status",
      label: "Responded",
      render: (w) => (w.httpStatusReturned !== null ? <Pill label={String(w.httpStatusReturned)} tone="success" /> : <span className="muted small">—</span>),
    },
    { key: "received", label: "Received", render: (w) => formatDateTime(w.receivedAt) },
    { key: "retry", label: "Next retry", render: (w) => (w.nextRetryAt ? formatDateTime(w.nextRetryAt) : <span className="muted small">—</span>) },
  ];

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader title="Webhook Log" description="Inbound Channex webhooks and retry backoff" />
        <div className="card">
          <p className="muted">This page requires the Super_Admin role — your account doesn't have it.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Webhook Log" description="Inbound Channex webhooks and retry backoff" />
      {error && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">{error}</p>
        </div>
      )}
      <div className="card">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(w) => w.id}
          emptyMessage={loading ? "Loading…" : "No webhook calls received yet."}
        />
      </div>
    </div>
  );
}
