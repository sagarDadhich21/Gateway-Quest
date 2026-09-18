import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { WebhookLogRow, webhookLogs } from "../../mockData/monitoring";

const columns: DataTableColumn<WebhookLogRow>[] = [
  { key: "event", label: "Event", render: (r) => <code>{r.event}</code> },
  { key: "ref", label: "Reference", render: (r) => r.ref },
  { key: "attempt", label: "Attempt", align: "right", render: (r) => `${r.attempt} / 11` },
  {
    key: "code",
    label: "Response",
    render: (r) => (r.code ? <Pill label={String(r.code)} tone={r.code >= 400 ? "error" : "success"} /> : <span className="muted">—</span>),
  },
  { key: "at", label: "At", render: (r) => r.at },
  { key: "next", label: "Next retry", render: (r) => r.next ?? <span className="muted">—</span> },
];

export function WebhookLog() {
  return (
    <div>
      <PageHeader title="Webhook Log" description="Inbound Channex webhooks and retry backoff" />
      <MockDataNotice />
      <div className="card">
        <DataTable columns={columns} rows={webhookLogs} getRowKey={(r) => r.id} />
      </div>
    </div>
  );
}
