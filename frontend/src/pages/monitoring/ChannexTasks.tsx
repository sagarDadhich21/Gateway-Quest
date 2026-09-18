import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill, PillTone } from "../../components/Pill";
import { propName } from "../../mockData/channexMiddleware";
import { ChannexTaskRow, channexTasks } from "../../mockData/monitoring";

const STATUS_TONE: Record<ChannexTaskRow["status"], PillTone> = {
  Applied: "success",
  "Applied with warnings": "warning",
  Processing: "info",
  Failed: "error",
};

const columns: DataTableColumn<ChannexTaskRow>[] = [
  { key: "id", label: "Task", render: (r) => <code>{r.id.slice(0, 18)}…</code> },
  { key: "pid", label: "Property", render: (r) => propName(r.pid) },
  { key: "endpoint", label: "Endpoint", render: (r) => <code>{r.endpoint}</code> },
  { key: "rows", label: "Rows", align: "right", render: (r) => r.rows },
  { key: "warnings", label: "Warnings", align: "right", render: (r) => r.warnings },
  { key: "at", label: "When", render: (r) => <span className="muted">{r.at}</span> },
  { key: "status", label: "Status", render: (r) => <Pill label={r.status} tone={STATUS_TONE[r.status]} /> },
];

export function ChannexTasks() {
  return (
    <div>
      <PageHeader title="Channex Tasks" description="Task IDs returned by ARI writes, with warnings" />
      <MockDataNotice />
      <div className="card">
        <DataTable columns={columns} rows={channexTasks} getRowKey={(r) => r.id} />
      </div>
    </div>
  );
}
