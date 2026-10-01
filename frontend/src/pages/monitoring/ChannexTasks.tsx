import { useEffect, useState } from "react";
import { useIsSuperAdmin } from "../../auth/useIsSuperAdmin";
import { extractErrorMessage } from "../../api/client";
import { listPushTasks } from "../../api/gqApi";
import { PushTaskResponse } from "../../api/types";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pill, PillTone } from "../../components/Pill";
import { formatDateTime } from "../bookings/revisionCells";

const STATUS_TONE: Record<string, PillTone> = {
  confirmed: "success",
  unconfirmed: "warning",
  pending: "info",
};

/** gq_push_task - one row per ARI availability/restrictions push (see ari.service.ts). Not property-scoped, admin only. */
export function ChannexTasks() {
  const isSuperAdmin = useIsSuperAdmin();
  const [rows, setRows] = useState<PushTaskResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError(null);
    listPushTasks()
      .then(setRows)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isSuperAdmin]);

  const columns: DataTableColumn<PushTaskResponse>[] = [
    { key: "type", label: "Task type", render: (t) => <code>{t.taskType}</code> },
    { key: "cxId", label: "Channex task ID", render: (t) => <span className="mono small">{t.cxTaskId}</span> },
    {
      key: "status",
      label: "Status",
      render: (t) => <Pill label={t.status} tone={STATUS_TONE[t.status] ?? "neutral"} />,
    },
    {
      key: "warnings",
      label: "Warnings",
      render: (t) => (t.warnings ? <span className="small">{JSON.stringify(t.warnings)}</span> : <span className="muted small">—</span>),
    },
    { key: "created", label: "Created", render: (t) => formatDateTime(t.createdAt) },
  ];

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader title="Channex Tasks" description="Task IDs returned by ARI writes, with warnings" />
        <div className="card">
          <p className="muted">This page requires the Super_Admin role — your account doesn't have it.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Channex Tasks" description="Task IDs returned by ARI writes, with warnings" />
      {error && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">{error}</p>
        </div>
      )}
      <div className="card">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(t) => t.id}
          emptyMessage={loading ? "Loading…" : "No ARI pushes recorded yet."}
        />
      </div>
    </div>
  );
}
