import { useMemo, useState } from "react";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { Tabs } from "../../components/Tabs";
import { propName } from "../../mockData/channexMiddleware";
import { ApiLogRow, apiLogs } from "../../mockData/monitoring";

const TAB_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Errors", value: "errors" },
  { label: "Warnings", value: "warnings" },
];

const columns: DataTableColumn<ApiLogRow>[] = [
  { key: "at", label: "When", render: (r) => <span className="muted">{r.at}</span> },
  { key: "method", label: "Method", render: (r) => <code>{r.method}</code> },
  { key: "endpoint", label: "Endpoint", render: (r) => <code>{r.endpoint}</code> },
  { key: "pid", label: "Property", render: (r) => (r.pid ? propName(r.pid) : <span className="muted">account</span>) },
  {
    key: "code",
    label: "Code",
    render: (r) => <Pill label={String(r.code)} tone={r.code >= 400 ? "error" : "success"} />,
  },
  { key: "ms", label: "Latency", align: "right", render: (r) => `${r.ms} ms` },
];

export function ApiLogs() {
  const [tab, setTab] = useState("all");

  const filtered = useMemo(() => {
    if (tab === "errors") return apiLogs.filter((r) => r.code >= 400);
    if (tab === "warnings") return apiLogs.filter((r) => r.warnings > 0);
    return apiLogs;
  }, [tab]);

  return (
    <div>
      <PageHeader title="API Logs" description="Every request Gateway Quest makes to Channex" />
      <MockDataNotice />
      <div className="card">
        <Tabs options={TAB_OPTIONS} active={tab} onChange={setTab} />
        <DataTable columns={columns} rows={filtered} getRowKey={(r) => r.id} />
      </div>
    </div>
  );
}
