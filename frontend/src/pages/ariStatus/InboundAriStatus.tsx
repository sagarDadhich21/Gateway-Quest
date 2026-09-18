import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill, PillTone } from "../../components/Pill";
import { propById, propName, ratePlanById, roomTypeById } from "../../mockData/channexMiddleware";
import { ReviewQueueItem, reviewQueueItems } from "../../mockData/ariStatus";
import { money, fmt } from "../../lib/format";

const DECISION_TONE: Record<ReviewQueueItem["decision"], PillTone> = {
  Forwarded: "success",
  Held: "error",
  Pending: "warning",
};

function targetName(item: ReviewQueueItem): string {
  if (item.kind === "availability") return roomTypeById(item.target)?.eqName ?? item.target;
  return ratePlanById(item.target)?.eqName ?? item.target;
}

function formatValue(item: ReviewQueueItem, value: number): string {
  if (item.field === "rate") {
    const currency = propById(item.pid)?.currency ?? "INR";
    return money(value, currency);
  }
  return fmt(value);
}

const columns: DataTableColumn<ReviewQueueItem>[] = [
  { key: "id", label: "ID", render: (r) => <code>{r.id}</code> },
  { key: "pid", label: "Property", render: (r) => propName(r.pid) },
  { key: "target", label: "Target", render: (r) => targetName(r) },
  { key: "field", label: "Field", render: (r) => <code>{r.field}</code> },
  { key: "dateRange", label: "Date range", render: (r) => `${r.dateFrom} → ${r.dateTo}` },
  { key: "eqValue", label: "EQ value", align: "right", render: (r) => formatValue(r, r.eqValue) },
  { key: "liveValue", label: "Live on Channex", align: "right", render: (r) => formatValue(r, r.liveValue) },
  { key: "decision", label: "Decision", render: (r) => <Pill label={r.decision} tone={DECISION_TONE[r.decision]} /> },
];

export function InboundAriStatus() {
  return (
    <div>
      <PageHeader
        title="Inbound ARI Status"
        description="Read-only — shows what Enterprise Quest sent and whether it has been forwarded to Channex"
      />
      <MockDataNotice />
      <div className="card">
        <DataTable columns={columns} rows={reviewQueueItems} getRowKey={(r) => r.id} />
      </div>
    </div>
  );
}
