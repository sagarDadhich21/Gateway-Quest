import { Link } from "react-router-dom";
import { DonutChart } from "../../components/DonutChart";
import { Icon } from "../../components/Icon";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { StatBlock } from "../../components/StatBlock";
import { channexProperties, channexRatePlans, channexRoomTypes, otaChannels, propName } from "../../mockData/channexMiddleware";
import { bookingRevisions } from "../../mockData/bookings";
import { CX, counters } from "../../mockData/core";
import { apiLogs, channexTasks, errorQueueRows } from "../../mockData/monitoring";
import { fmt, money } from "../../lib/format";

/**
 * Consolidated into one page, matching PAGES.reports in the source exactly - it is not
 * split into separate nav items. All figures are derived live from the same core mock
 * data used elsewhere (bookings, tasks, api logs, errors, channels), not a separate
 * "reports" dataset, mirroring the source's own approach.
 */
export function Reports() {
  const byStatus = { new: 0, modified: 0, cancelled: 0 } as Record<string, number>;
  bookingRevisions.forEach((b) => { byStatus[b.status] = (byStatus[b.status] ?? 0) + 1; });
  const totalAmount = bookingRevisions.reduce((a, b) => a + b.amount, 0);
  const ackRate = bookingRevisions.length
    ? Math.round((bookingRevisions.filter((b) => b.acked).length / bookingRevisions.length) * 100)
    : 100;

  const tasksApplied = channexTasks.filter((t) => t.status === "Applied").length;
  const tasksWarn = channexTasks.filter((t) => t.status === "Applied with warnings").length;
  const tasksProcessing = channexTasks.filter((t) => t.status === "Processing").length;
  const tasksFailed = channexTasks.filter((t) => t.status === "Failed").length;
  const avgLatency = apiLogs.length ? Math.round(apiLogs.reduce((a, l) => a + l.ms, 0) / apiLogs.length) : 0;

  const errOpen = errorQueueRows.filter((e) => e.status === "Pending").length;
  const errResolved = errorQueueRows.filter((e) => e.status === "Resolved").length;
  const errDismissed = errorQueueRows.filter((e) => e.status === "Dismissed").length;

  const rlPct = Math.round((CX.rateLimit.used / CX.rateLimit.limit) * 100);
  const successPct = channexTasks.length
    ? Math.round((channexTasks.filter((t) => t.status !== "Failed").length / channexTasks.length) * 100)
    : 100;
  const totalWarnRows = channexTasks.reduce((a, t) => a + t.warnings, 0);
  const channelsMapped = otaChannels.reduce((a, c) => a + c.mappedRooms, 0);
  const channelsTotal = otaChannels.reduce((a, c) => a + c.totalRooms, 0);
  const chPct = channelsTotal ? Math.round((channelsMapped / channelsTotal) * 100) : 0;

  return (
    <div>
      <PageHeader title="Reports" description="Operational and management reporting across the pipeline" />
      <MockDataNotice />

      <div className="card" style={{ marginBottom: 18 }}>
        <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          Reports are computed live from Gateway Quest&apos;s own records — Enterprise Quest-owned values pass through
          unmodified; only the counts and rates below belong to Gateway Quest.
        </p>
      </div>

      <h2 className="section-title">Operational reports</h2>

      <div className="card" style={{ marginBottom: 16, padding: 20 }}>
        <div className="card-head-row">
          <div>
            <h3>Reservation activity</h3>
            <p>{bookingRevisions.length} revision(s) on file</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="button button--ghost"><Icon name="download" size="sm" /> Download CSV</button>
            <Link className="button button--ghost" to="/bookings/revisions">Open bookings →</Link>
          </div>
        </div>
        <div style={{ padding: "0 20px 20px" }}>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <StatBlock label="New" value={byStatus.new ?? 0} hint="Fresh bookings" icon="mail" />
            <StatBlock label="Modified" value={byStatus.modified ?? 0} hint="Changed bookings" icon="edit" />
            <StatBlock label="Cancelled" value={byStatus.cancelled ?? 0} hint="Cancelled bookings" icon="x-circle" />
            <StatBlock label="Acknowledged" value={`${ackRate}%`} hint={`${money(totalAmount, "INR")} total booked value`} icon="check-circle" color={ackRate === 100 ? "var(--success)" : "var(--warning)"} />
          </div>
          <div className="report-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Revision</th><th>OTA</th><th>Property</th><th>Guest</th><th>Status</th><th>Arrival</th><th>Amount</th><th>Ack</th></tr>
              </thead>
              <tbody>
                {bookingRevisions.map((b) => (
                  <tr key={b.id}>
                    <td><code>{b.id}</code></td>
                    <td>{b.ota}</td>
                    <td>{propName(b.pid)}</td>
                    <td>{b.guest}</td>
                    <td><Pill label={b.status} tone={b.status === "cancelled" ? "error" : b.status === "modified" ? "purple" : "info"} /></td>
                    <td>{b.arrival}</td>
                    <td>{money(b.amount, "INR")}</td>
                    <td>{b.acked ? <Pill label="Yes" tone="success" /> : <Pill label="No" tone="warning" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 20 }}>
        <div className="card-head-row">
          <div>
            <h3>Sync activity</h3>
            <p>Channex task outcomes</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="button button--ghost"><Icon name="download" size="sm" /> Download CSV</button>
            <Link className="button button--ghost" to="/monitoring/tasks">Open tasks →</Link>
          </div>
        </div>
        <div style={{ padding: "0 20px 20px" }}>
          <div className="stat-grid" style={{ marginBottom: 18 }}>
            <StatBlock label="Applied" value={tasksApplied} hint="Clean pushes" icon="check-circle" color="var(--success)" />
            <StatBlock label="Applied w/ warnings" value={tasksWarn} hint="Partial rejections" icon="alert-circle" color={tasksWarn ? "var(--warning)" : "var(--success)"} />
            <StatBlock label="Processing" value={tasksProcessing} hint="In flight" icon="clock" />
            <StatBlock label="Failed" value={tasksFailed} hint={`${avgLatency}ms avg API latency`} icon="alert-triangle" color={tasksFailed ? "var(--danger)" : "var(--success)"} />
          </div>
          {channexTasks.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <DonutChart
                centerLabel="tasks"
                segments={[
                  { label: "Applied", value: tasksApplied, color: "#0fa968" },
                  { label: "Applied w/ warnings", value: tasksWarn, color: "#e58a00" },
                  { label: "Processing", value: tasksProcessing, color: "#2952cc" },
                  { label: "Failed", value: tasksFailed, color: "#dc3a2e" },
                ]}
              />
            </div>
          )}
          <div className="report-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Task</th><th>Property</th><th>Endpoint</th><th>Rows</th><th>Warnings</th><th>When</th><th>Status</th></tr>
              </thead>
              <tbody>
                {channexTasks.map((t) => (
                  <tr key={t.id}>
                    <td><code>{t.id.slice(0, 18)}…</code></td>
                    <td>{propName(t.pid)}</td>
                    <td><code>{t.endpoint}</code></td>
                    <td>{t.rows}</td>
                    <td>{t.warnings}</td>
                    <td className="muted">{t.at}</td>
                    <td>
                      <Pill
                        label={t.status}
                        tone={t.status === "Applied" ? "success" : t.status === "Failed" ? "error" : t.status === "Processing" ? "info" : "warning"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 20 }}>
        <div className="card-head-row">
          <div>
            <h3>Failed transactions</h3>
            <p>Error queue breakdown</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="button button--ghost"><Icon name="download" size="sm" /> Download CSV</button>
            <Link className="button button--ghost" to="/monitoring/error-queue">Open queue →</Link>
          </div>
        </div>
        <div style={{ padding: "0 20px 20px" }}>
          <div className="stat-grid" style={{ marginBottom: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <StatBlock label="Open" value={errOpen} hint="Awaiting retry or dismiss" icon="alert-triangle" color={errOpen ? "var(--danger)" : "var(--success)"} />
            <StatBlock label="Resolved" value={errResolved} hint="Retried successfully" icon="check-circle" color="var(--success)" />
            <StatBlock label="Dismissed" value={errDismissed} hint="Left unsynced on purpose" icon="minus-circle" />
          </div>
          <div className="report-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Error</th><th>Type</th><th>Property</th><th>Detail</th><th>Retries</th><th>Status</th></tr>
              </thead>
              <tbody>
                {errorQueueRows.map((e) => (
                  <tr key={e.id}>
                    <td><code>{e.id}</code></td>
                    <td><Pill label={e.kind} tone={e.kind.includes("429") ? "warning" : "error"} /></td>
                    <td>{propName(e.pid)}</td>
                    <td className="muted" style={{ maxWidth: 280 }}>{e.detail}</td>
                    <td>{e.retries}</td>
                    <td><Pill label={e.status} tone={e.status === "Pending" ? "warning" : e.status === "Resolved" ? "success" : "neutral"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="card-head-row">
          <div>
            <h3>Provider health</h3>
            <p>Channex connection</p>
          </div>
          <Link className="button button--ghost" to="/channex/connection">Open connection →</Link>
        </div>
        <div className="stat-grid" style={{ padding: "0 20px 20px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <StatBlock label="Status" value={CX.status} hint={`${CX.latency}ms latency`} icon="zap" color={CX.status === "Connected" ? "var(--success)" : "var(--danger)"} />
          <StatBlock label="Rate limit used" value={`${rlPct}%`} hint={`${fmt(CX.rateLimit.used)} of ${fmt(CX.rateLimit.limit)} ${CX.rateLimit.window}`} icon="clock" color={rlPct > 80 ? "var(--danger)" : "var(--text)"} />
          <StatBlock label="Webhook events" value={CX.webhookEvents.length} hint="Subscribed event types" icon="bell" />
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: 22 }}>Management reports</h2>

      <div className="card" style={{ marginBottom: 16, padding: 20 }}>
        <div className="card-head-row">
          <div>
            <h3>Provider usage</h3>
            <p>Account-wide, this session</p>
          </div>
          <button type="button" className="button button--ghost"><Icon name="download" size="sm" /> Download CSV</button>
        </div>
        <div style={{ padding: "0 20px 20px" }}>
          <div className="stat-grid" style={{ marginBottom: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <StatBlock label="Pushes today" value={fmt(counters.pushesToday)} hint="Availability + rate rows" icon="send" />
            <StatBlock label="API calls logged" value={fmt(apiLogs.length)} hint={`${avgLatency}ms average`} icon="terminal" />
            <StatBlock label="Tasks on record" value={fmt(channexTasks.length)} hint="Across all properties" icon="activity" />
          </div>
          <div className="report-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Method</th><th>Endpoint</th><th>Property</th><th>Code</th><th>Latency</th><th>When</th></tr>
              </thead>
              <tbody>
                {apiLogs.map((l) => (
                  <tr key={l.id}>
                    <td><code>{l.method}</code></td>
                    <td><code>{l.endpoint}</code></td>
                    <td>{l.pid ? propName(l.pid) : "account"}</td>
                    <td><Pill label={String(l.code)} tone={l.code >= 400 ? "error" : "success"} /></td>
                    <td>{l.ms} ms</td>
                    <td className="muted">{l.at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 20 }}>
        <div className="card-head-row">
          <div>
            <h3>Hotel activity</h3>
            <p>Per-property distribution snapshot</p>
          </div>
          <button type="button" className="button button--ghost"><Icon name="download" size="sm" /> Download CSV</button>
        </div>
        <div style={{ padding: "0 20px 20px" }}>
          <div className="report-table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Property</th><th>Bookings</th><th>Tasks</th><th>Mapping coverage</th><th>Active channels</th></tr>
            </thead>
            <tbody>
              {channexProperties.map((p) => {
                const pBookings = bookingRevisions.filter((b) => b.pid === p.id).length;
                const pTasks = channexTasks.filter((t) => t.pid === p.id).length;
                const rts = channexRoomTypes.filter((r) => r.pid === p.id);
                const rps = channexRatePlans.filter((r) => r.pid === p.id);
                const mappedCount = rts.filter((r) => r.mapped).length + rps.filter((r) => r.mapped).length;
                const totalCount = rts.length + rps.length;
                const pct = totalCount ? Math.round((mappedCount / totalCount) * 100) : 0;
                const activeCh = otaChannels.filter((c) => c.pid === p.id && c.status === "Active").length;
                const totalCh = otaChannels.filter((c) => c.pid === p.id).length;
                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{pBookings}</td>
                    <td>{pTasks}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="mini-bar" style={{ width: 80 }}>
                          <div className="mini-bar-fill" style={{ width: `${pct}%`, background: pct === 100 ? "var(--success)" : pct === 0 ? "var(--danger)" : "var(--warning)" }} />
                        </div>
                        <span className="muted" style={{ fontSize: 12 }}>{pct}%</span>
                      </div>
                    </td>
                    <td>{activeCh} / {totalCh}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="card-head-row">
          <h3>Distribution performance</h3>
        </div>
        <div style={{ padding: "0 20px 20px" }}>
          <div className="kv"><span className="k">Sync success rate</span><span>{successPct}%</span></div>
          <div className="mini-bar" style={{ margin: "6px 0 14px" }}>
            <div className="mini-bar-fill" style={{ width: `${successPct}%`, background: successPct < 90 ? "var(--danger)" : "var(--success)" }} />
          </div>
          <div className="kv"><span className="k">Channel room coverage</span><span>{channelsMapped} of {channelsTotal} ({chPct}%)</span></div>
          <div className="mini-bar" style={{ margin: "6px 0 14px" }}>
            <div className="mini-bar-fill" style={{ width: `${chPct}%`, background: chPct === 100 ? "var(--success)" : "var(--warning)" }} />
          </div>
          <div className="kv"><span className="k">Rows returning warnings</span><span>{totalWarnRows}</span></div>
          <div className="kv"><span className="k">Average API latency</span><span>{avgLatency}ms</span></div>
        </div>
      </div>
    </div>
  );
}
