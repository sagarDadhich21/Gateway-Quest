import { useEffect, useMemo, useState } from "react";
import { useCurrentPropertyId } from "../../auth/useCurrentProperty";
import { useIsSuperAdmin } from "../../auth/useIsSuperAdmin";
import { extractErrorMessage } from "../../api/client";
import { listBookingRevisions, listPushTasks, listWebhookLog } from "../../api/gqApi";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pill, PillTone } from "../../components/Pill";
import { formatDateTime } from "../bookings/revisionCells";

type EntryType = "webhook" | "push" | "revision";
type TypeFilter = "all" | EntryType;

interface AuditEntry {
  id: string;
  type: EntryType;
  time: string;
  summary: string;
  statusLabel: string;
  statusTone: PillTone;
  detail: string | null;
}

const TYPE_LABEL: Record<EntryType, string> = {
  webhook: "Webhook",
  push: "Push",
  revision: "Revision",
};

const TYPE_TONE: Record<EntryType, PillTone> = {
  webhook: "info",
  push: "purple",
  revision: "neutral",
};

const PUSH_STATUS_TONE: Record<string, PillTone> = {
  confirmed: "success",
  unconfirmed: "warning",
  pending: "info",
};

/**
 * No single `audit_log` table exists in the schema - this is a unified, real-data
 * timeline across the three tables that together cover "every inbound message,
 * decision and push" (this page's own description, unchanged from the source mockup):
 * gq_webhook_log (inbound), gq_ota_booking_revision (the decision - acked/blocked/
 * failed, with why), gq_push_task (outbound ARI pushes). No mock rows - if any of the
 * three sources is empty, it simply contributes nothing to the merged timeline.
 */
export function AuditLog() {
  const isSuperAdmin = useIsSuperAdmin();
  const propertyId = useCurrentPropertyId();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError(null);

    Promise.all([
      listWebhookLog(),
      listPushTasks(),
      propertyId !== null ? listBookingRevisions(propertyId) : Promise.resolve([]),
    ])
      .then(([webhooks, pushes, revisions]) => {
        const merged: AuditEntry[] = [
          ...webhooks.map((w): AuditEntry => ({
            id: `webhook-${w.id}`,
            type: "webhook",
            time: w.receivedAt,
            summary: `${w.event} → ${w.ref}${w.attempt > 1 ? ` (attempt ${w.attempt})` : ""}`,
            statusLabel: w.httpStatusReturned !== null ? `HTTP ${w.httpStatusReturned}` : "no response",
            statusTone: w.httpStatusReturned === 200 ? "success" : "warning",
            detail: null,
          })),
          ...pushes.map((p): AuditEntry => ({
            id: `push-${p.id}`,
            type: "push",
            time: p.createdAt,
            summary: `${p.taskType} push (${p.cxTaskId})`,
            statusLabel: p.status,
            statusTone: PUSH_STATUS_TONE[p.status] ?? "neutral",
            detail: p.warnings ? JSON.stringify(p.warnings) : null,
          })),
          ...revisions.map((r): AuditEntry => ({
            id: `revision-${r.id}`,
            type: "revision",
            time: r.receivedAt,
            summary: `${r.guestName ?? "Guest"} — ${r.status} booking`,
            statusLabel: r.ackStatus,
            statusTone: r.ackStatus === "acked" ? "success" : "warning",
            detail: r.blockingReason,
          })),
        ];
        merged.sort((a, b) => (a.time < b.time ? 1 : -1));
        setEntries(merged);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isSuperAdmin, propertyId]);

  const counts = useMemo(() => {
    const result: Record<EntryType, number> = { webhook: 0, push: 0, revision: 0 };
    for (const e of entries) result[e.type] += 1;
    return result;
  }, [entries]);

  const visible = typeFilter === "all" ? entries : entries.filter((e) => e.type === typeFilter);

  const columns: DataTableColumn<AuditEntry>[] = [
    { key: "time", label: "Time", render: (e) => formatDateTime(e.time) },
    { key: "type", label: "Type", render: (e) => <Pill label={TYPE_LABEL[e.type]} tone={TYPE_TONE[e.type]} /> },
    { key: "summary", label: "Summary", render: (e) => <span className="small">{e.summary}</span> },
    { key: "status", label: "Status", render: (e) => <Pill label={e.statusLabel} tone={e.statusTone} /> },
    {
      key: "detail",
      label: "Detail",
      render: (e) =>
        e.detail ? (
          <div className="revision-issue-cell" title={e.detail}>
            <span className="revision-issue-cell__reason">{e.detail}</span>
          </div>
        ) : (
          <span className="muted small">—</span>
        ),
    },
  ];

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader title="Audit Log" description="Every inbound message, decision and push" />
        <div className="card">
          <p className="muted">This page requires the Super_Admin role — your account doesn't have it.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Audit Log" description="Every inbound message, decision and push" />
      {error && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">{error}</p>
        </div>
      )}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="segmented">
          <button
            type="button"
            className={"segmented__btn" + (typeFilter === "all" ? " segmented__btn--active" : "")}
            onClick={() => setTypeFilter("all")}
          >
            All ({entries.length})
          </button>
          <button
            type="button"
            className={"segmented__btn" + (typeFilter === "webhook" ? " segmented__btn--active" : "")}
            onClick={() => setTypeFilter("webhook")}
          >
            Webhooks ({counts.webhook})
          </button>
          <button
            type="button"
            className={"segmented__btn" + (typeFilter === "revision" ? " segmented__btn--active" : "")}
            onClick={() => setTypeFilter("revision")}
          >
            Revisions ({counts.revision})
          </button>
          <button
            type="button"
            className={"segmented__btn" + (typeFilter === "push" ? " segmented__btn--active" : "")}
            onClick={() => setTypeFilter("push")}
          >
            Pushes ({counts.push})
          </button>
        </div>
      </div>
      <div className="card">
        <DataTable
          columns={columns}
          rows={visible}
          getRowKey={(e) => e.id}
          emptyMessage={
            loading ? "Loading…" : entries.length === 0 ? "Nothing recorded yet." : "Nothing in this category."
          }
        />
      </div>
    </div>
  );
}
