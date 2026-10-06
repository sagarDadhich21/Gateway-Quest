import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentPropertyId } from "../../auth/useCurrentProperty";
import { useIsSuperAdmin } from "../../auth/useIsSuperAdmin";
import { extractErrorMessage } from "../../api/client";
import {
  getRoomTypes,
  listApiLogs,
  listBookingRevisions,
  listBookings,
  listChannels,
  listErrorQueue,
  listPushTasks,
  listRatePlans,
} from "../../api/gqApi";
import {
  ApiLogResponse,
  ChannelResponse,
  ErrorQueueResponse,
  OtaBookingRevisionResponse,
  PushTaskResponse,
  RatePlan,
  RoomTypeSummary,
} from "../../api/types";
import { Icon } from "../../components/Icon";
import { PageHeader } from "../../components/PageHeader";
import { Pill, PillTone } from "../../components/Pill";
import { TablePagination } from "../../components/TablePagination";
import { usePagination } from "../../components/usePagination";
import { ACK_TONE, formatDateTime, STATUS_TONE } from "../bookings/revisionCells";

function money(amountMinorUnits: number, currency: string): string {
  const amount = (amountMinorUnits / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${amount}` : amount;
}

function downloadCSV(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [headers.map(q).join(","), ...rows.map((r) => r.map(q).join(","))];
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface ReportColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
}

/** Like DataTable, but wrapped in .report-table-wrap - see that class's comment in index.css. */
const REPORT_TABLE_PAGE_SIZE = 20;

function ReportTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = "No records.",
}: {
  columns: ReportColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
}) {
  const { page, totalPages, start, end, setPage } = usePagination(rows.length, REPORT_TABLE_PAGE_SIZE);
  const visibleRows = rows.slice(start, end);

  return (
    <div className="report-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="data-table__empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            visibleRows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {rows.length > REPORT_TABLE_PAGE_SIZE && (
        <TablePagination page={page} totalPages={totalPages} start={start} end={end} total={rows.length} onPageChange={setPage} />
      )}
    </div>
  );
}

function StatBlock({
  label,
  value,
  hint,
  icon,
  tone = "var(--text)",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: string;
  tone?: string;
}) {
  return (
    <div className="card stat-block">
      <div className="stat-block__top">
        <span className="stat-block__label">{label}</span>
        <span className="stat-block__icon" style={{ color: tone }}>
          <Icon name={icon} />
        </span>
      </div>
      <div className="stat-block__value" style={{ color: tone }}>
        {value}
      </div>
      {hint && <div className="stat-block__hint">{hint}</div>}
    </div>
  );
}

function CardHead({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="card-head-row">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
    </div>
  );
}

const PUSH_STATUS_TONE: Record<string, PillTone> = {
  confirmed: "success",
  unconfirmed: "warning",
  pending: "info",
};

const PUSH_STATUS_TOTALS_ORDER = ["confirmed", "unconfirmed", "pending"];

/**
 * Real, live reports computed from Gateway Quest's own records - no sample data. Every
 * number here comes straight from the same tables the Bookings/Monitoring pages already
 * read (gq_ota_booking_revision, gq_push_task, gq_api_log, gq_error_queue) plus the
 * current property's room-type/rate-plan/channel onboarding state; nothing is invented
 * for this page. Reservation activity and the property snapshot are scoped to the
 * logged-in user's own property and visible to anyone with access to it; the four
 * account-wide sections below mirror the Monitoring pages' own Super_Admin gating, since
 * they read the exact same admin-only endpoints.
 */
export function Reports() {
  const propertyId = useCurrentPropertyId();
  const isSuperAdmin = useIsSuperAdmin();

  const [revisions, setRevisions] = useState<OtaBookingRevisionResponse[]>([]);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [roomTypes, setRoomTypes] = useState<RoomTypeSummary[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [channels, setChannels] = useState<ChannelResponse[]>([]);
  const [pushTasks, setPushTasks] = useState<PushTaskResponse[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiLogResponse[]>([]);
  const [errorQueue, setErrorQueue] = useState<ErrorQueueResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (propertyId === null) return;
    setLoading(true);
    setError(null);
    Promise.all([
      listBookingRevisions(propertyId),
      listBookings(propertyId),
      getRoomTypes(propertyId),
      listRatePlans(propertyId),
      listChannels(propertyId),
    ])
      .then(([rev, bookings, rt, rp, ch]) => {
        setRevisions(rev);
        setBookingsCount(bookings.length);
        setRoomTypes(rt);
        setRatePlans(rp);
        setChannels(ch);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [propertyId]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    Promise.all([listPushTasks(), listApiLogs(), listErrorQueue()])
      .then(([tasks, logs, errs]) => {
        setPushTasks(tasks);
        setApiLogs(logs);
        setErrorQueue(errs);
      })
      .catch((err) => setError(extractErrorMessage(err)));
  }, [isSuperAdmin]);

  function inDateRange(iso: string | null): boolean {
    if (!dateFrom && !dateTo) return true;
    if (!iso) return false;
    if (dateFrom && iso < dateFrom) return false;
    if (dateTo && iso > dateTo) return false;
    return true;
  }

  const filteredRevisions = useMemo(
    () => revisions.filter((r) => inDateRange(r.arrivalDate)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revisions, dateFrom, dateTo]
  );

  const byStatus = useMemo(() => {
    const counts = { new: 0, modified: 0, cancelled: 0 };
    filteredRevisions.forEach((r) => {
      counts[r.status] += 1;
    });
    return counts;
  }, [filteredRevisions]);

  const totalAmount = filteredRevisions.reduce((a, r) => a + r.amountMinorUnits, 0);
  const revisionCurrency = filteredRevisions[0]?.currency ?? "";
  const ackedCount = filteredRevisions.filter((r) => r.ackStatus === "acked").length;
  const ackRate = filteredRevisions.length ? Math.round((ackedCount / filteredRevisions.length) * 100) : 100;

  const roomTypesOnboarded = roomTypes.filter((t) => t.channex.onboarded).length;
  const ratePlansOnboarded = ratePlans.filter((p) => p.channex.onboarded).length;
  const mappedCount = roomTypesOnboarded + ratePlansOnboarded;
  const totalMappable = roomTypes.length + ratePlans.length;
  const mappingPct = totalMappable ? Math.round((mappedCount / totalMappable) * 100) : 0;
  const activeChannels = channels.filter((c) => c.isActive).length;

  const taskCounts: Record<string, number> = {};
  pushTasks.forEach((t) => {
    taskCounts[t.status] = (taskCounts[t.status] ?? 0) + 1;
  });
  const tasksWithWarnings = pushTasks.filter((t) => t.warnings !== null && t.warnings !== undefined).length;
  const avgLatency = apiLogs.length ? Math.round(apiLogs.reduce((a, l) => a + l.latencyMs, 0) / apiLogs.length) : 0;
  const apiErrorCount = apiLogs.filter((l) => l.httpStatus >= 400).length;
  const syncSuccessPct = pushTasks.length
    ? Math.round((pushTasks.filter((t) => t.status === "confirmed").length / pushTasks.length) * 100)
    : 100;

  function exportReservationActivity() {
    downloadCSV(
      "reservation-activity.csv",
      ["Revision", "Status", "Ack", "Arrival", "Departure", "Guest", "Amount", "Currency"],
      filteredRevisions.map((r) => [
        r.cxRevisionId,
        r.status,
        r.ackStatus,
        r.arrivalDate ?? "",
        r.departureDate ?? "",
        r.guestName ?? "",
        (r.amountMinorUnits / 100).toFixed(2),
        r.currency,
      ])
    );
  }

  function exportSyncActivity() {
    downloadCSV(
      "sync-activity.csv",
      ["Task", "Type", "Status", "Warnings", "When"],
      pushTasks.map((t) => [t.cxTaskId, t.taskType, t.status, t.warnings ? "yes" : "no", t.createdAt])
    );
  }

  function exportFailedTransactions() {
    downloadCSV(
      "failed-transactions.csv",
      ["Error", "Source", "Detail", "Retries", "When"],
      errorQueue.map((e) => [e.id, e.source, e.errorMessage, e.retryCount, e.createdAt])
    );
  }

  function exportProviderUsage() {
    downloadCSV(
      "provider-usage.csv",
      ["Method", "Endpoint", "Code", "Latency (ms)", "When"],
      apiLogs.map((l) => [l.method, l.endpoint, l.httpStatus, l.latencyMs, l.createdAt])
    );
  }

  return (
    <div>
      <PageHeader title="Reports" description="Operational and management reporting across the pipeline" />

      {error && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">
            {error}
          </p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field__label">From (arrival date)</span>
              <input
                type="date"
                className="field__input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field__label">To (arrival date)</span>
              <input type="date" className="field__input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear dates
              </button>
            )}
          </div>
          <div className="small muted" style={{ maxWidth: 280 }}>
            Date range filters Reservation activity by arrival date. Other reports reflect every record currently on
            file.
          </div>
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: 0 }}>
        Operational reports
      </h2>

      {propertyId === null ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <p className="muted">Your account has no assigned property, so Reservation activity and the property
            snapshot have nothing to load.</p>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <CardHead
              title="Reservation activity"
              description={`${filteredRevisions.length} revision(s) in range`}
              actions={
                <>
                  <button type="button" className="button button--ghost" onClick={exportReservationActivity}>
                    <Icon name="download" size="sm" /> Download CSV
                  </button>
                  <Link to="/bookings/revisions" className="button button--ghost">
                    Open bookings →
                  </Link>
                </>
              }
            />
            <div className="stat-grid">
              <StatBlock label="New" value={byStatus.new} hint="Fresh bookings" icon="mail" />
              <StatBlock label="Modified" value={byStatus.modified} hint="Changed bookings" icon="edit" />
              <StatBlock label="Cancelled" value={byStatus.cancelled} hint="Cancelled bookings" icon="x-circle" />
              <StatBlock
                label="Acknowledged"
                value={`${ackRate}%`}
                hint={`${money(totalAmount, revisionCurrency)} total booked value`}
                icon="check-circle"
                tone={ackRate === 100 ? "var(--success)" : "var(--warning)"}
              />
            </div>
            <ReportTable
              columns={[
                { key: "revision", label: "Revision", render: (r: OtaBookingRevisionResponse) => <code>{r.cxRevisionId}</code> },
                { key: "guest", label: "Guest", render: (r: OtaBookingRevisionResponse) => r.guestName ?? "—" },
                {
                  key: "status",
                  label: "Status",
                  render: (r: OtaBookingRevisionResponse) => <Pill label={r.status} tone={STATUS_TONE[r.status]} />,
                },
                { key: "arrival", label: "Arrival", render: (r: OtaBookingRevisionResponse) => r.arrivalDate ?? "—" },
                {
                  key: "amount",
                  label: "Amount",
                  render: (r: OtaBookingRevisionResponse) => money(r.amountMinorUnits, r.currency),
                },
                {
                  key: "ack",
                  label: "Ack",
                  render: (r: OtaBookingRevisionResponse) => <Pill label={r.ackStatus} tone={ACK_TONE[r.ackStatus]} />,
                },
              ]}
              rows={filteredRevisions}
              getRowKey={(r) => r.id}
              emptyMessage={loading ? "Loading…" : "No revisions in this date range."}
            />
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <CardHead title="Property snapshot" description="Onboarding and distribution coverage for your property" />
            <div className="stat-grid">
              <StatBlock label="Bookings" value={bookingsCount} hint="Distinct OTA bookings" icon="list" />
              <StatBlock
                label="Mapping coverage"
                value={`${mappingPct}%`}
                hint={`${mappedCount} of ${totalMappable} room types + rate plans`}
                icon="list-check"
                tone={mappingPct === 100 ? "var(--success)" : mappingPct === 0 ? "var(--danger)" : "var(--warning)"}
              />
              <StatBlock
                label="Channels"
                value={`${activeChannels} / ${channels.length}`}
                hint="Active OTA channels"
                icon="swap"
              />
            </div>
          </div>
        </>
      )}

      {isSuperAdmin && (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <CardHead
              title="Sync activity"
              description="Channex ARI push task outcomes, account-wide"
              actions={
                <>
                  <button type="button" className="button button--ghost" onClick={exportSyncActivity}>
                    <Icon name="download" size="sm" /> Download CSV
                  </button>
                  <Link to="/monitoring/tasks" className="button button--ghost">
                    Open tasks →
                  </Link>
                </>
              }
            />
            <div className="stat-grid">
              {PUSH_STATUS_TOTALS_ORDER.map((status) => (
                <StatBlock
                  key={status}
                  label={status.charAt(0).toUpperCase() + status.slice(1)}
                  value={taskCounts[status] ?? 0}
                  icon={status === "confirmed" ? "check-circle" : status === "unconfirmed" ? "alert-triangle" : "clock"}
                  tone={
                    status === "confirmed" ? "var(--success)" : status === "unconfirmed" ? "var(--warning)" : "var(--text)"
                  }
                />
              ))}
              <StatBlock
                label="With warnings"
                value={tasksWithWarnings}
                hint={`${pushTasks.length} task(s) on record`}
                icon="alert-triangle"
                tone={tasksWithWarnings ? "var(--warning)" : "var(--success)"}
              />
            </div>
            <ReportTable
              columns={[
                { key: "task", label: "Task", render: (t: PushTaskResponse) => <code>{t.cxTaskId.slice(0, 18)}…</code> },
                { key: "type", label: "Type", render: (t: PushTaskResponse) => t.taskType },
                {
                  key: "status",
                  label: "Status",
                  render: (t: PushTaskResponse) => <Pill label={t.status} tone={PUSH_STATUS_TONE[t.status] ?? "neutral"} />,
                },
                { key: "when", label: "When", render: (t: PushTaskResponse) => formatDateTime(t.createdAt) },
              ]}
              rows={pushTasks}
              getRowKey={(t) => t.id}
              emptyMessage="No push tasks on record."
            />
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <CardHead
              title="Failed transactions"
              description="Error queue entries, account-wide"
              actions={
                <>
                  <button type="button" className="button button--ghost" onClick={exportFailedTransactions}>
                    <Icon name="download" size="sm" /> Download CSV
                  </button>
                  <Link to="/monitoring/error-queue" className="button button--ghost">
                    Open queue →
                  </Link>
                </>
              }
            />
            <div className="stat-grid">
              <StatBlock
                label="Logged errors"
                value={errorQueue.length}
                hint="Awaiting manual follow-up"
                icon="alert-triangle"
                tone={errorQueue.length ? "var(--danger)" : "var(--success)"}
              />
            </div>
            <ReportTable
              columns={[
                { key: "error", label: "Error", render: (e: ErrorQueueResponse) => <code>{e.id.slice(0, 8)}</code> },
                { key: "source", label: "Source", render: (e: ErrorQueueResponse) => e.source },
                {
                  key: "detail",
                  label: "Detail",
                  render: (e: ErrorQueueResponse) => (
                    <div className="revision-issue-cell" title={e.errorMessage}>
                      <span className="revision-issue-cell__reason">{e.errorMessage}</span>
                    </div>
                  ),
                },
                { key: "retries", label: "Retries", render: (e: ErrorQueueResponse) => e.retryCount },
                { key: "when", label: "When", render: (e: ErrorQueueResponse) => formatDateTime(e.createdAt) },
              ]}
              rows={errorQueue}
              getRowKey={(e) => e.id}
              emptyMessage="No errors on file."
            />
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <CardHead
              title="Provider usage"
              description="Channex API calls, account-wide"
              actions={
                <>
                  <button type="button" className="button button--ghost" onClick={exportProviderUsage}>
                    <Icon name="download" size="sm" /> Download CSV
                  </button>
                  <Link to="/monitoring/api-logs" className="button button--ghost">
                    Open logs →
                  </Link>
                </>
              }
            />
            <div className="stat-grid">
              <StatBlock label="API calls logged" value={apiLogs.length} icon="terminal" />
              <StatBlock label="Average latency" value={`${avgLatency} ms`} icon="clock" />
              <StatBlock
                label="Errored calls"
                value={apiErrorCount}
                hint="HTTP 400 and above"
                icon="alert-triangle"
                tone={apiErrorCount ? "var(--warning)" : "var(--success)"}
              />
            </div>
            <ReportTable
              columns={[
                { key: "method", label: "Method", render: (l: ApiLogResponse) => <code>{l.method}</code> },
                { key: "endpoint", label: "Endpoint", render: (l: ApiLogResponse) => <code>{l.endpoint}</code> },
                {
                  key: "code",
                  label: "Code",
                  render: (l: ApiLogResponse) => (
                    <Pill label={String(l.httpStatus)} tone={l.httpStatus >= 400 ? "error" : "success"} />
                  ),
                },
                { key: "latency", label: "Latency", render: (l: ApiLogResponse) => `${l.latencyMs} ms` },
                { key: "when", label: "When", render: (l: ApiLogResponse) => formatDateTime(l.createdAt) },
              ]}
              rows={apiLogs}
              getRowKey={(l) => l.id}
              emptyMessage="No API calls logged yet."
            />
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <CardHead title="Distribution performance" description="How cleanly Gateway Quest is getting data to Channex" />
            <div className="kv">
              <span className="k">Sync success rate</span>
              <span>{syncSuccessPct}%</span>
            </div>
            <div className="mini-bar" style={{ margin: "6px 0 14px" }}>
              <div
                className="mini-bar-fill"
                style={{
                  width: `${syncSuccessPct}%`,
                  background: syncSuccessPct < 90 ? "var(--danger)" : "var(--success)",
                }}
              />
            </div>
            <div className="kv">
              <span className="k">Average API latency</span>
              <span>{avgLatency}ms</span>
            </div>
            <div className="kv">
              <span className="k">Errors logged</span>
              <span>{errorQueue.length}</span>
            </div>
          </div>
        </>
      )}

      {!isSuperAdmin && propertyId !== null && (
        <div className="card">
          <p className="muted">
            Sync activity, failed transactions, provider usage and distribution performance require the Super_Admin
            role — your account doesn't have it.
          </p>
        </div>
      )}
    </div>
  );
}
