import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill, PillTone } from "../../components/Pill";
import { propName, ratePlanById } from "../../mockData/channexMiddleware";
import { RestrictionRow, restrictionRows } from "../../mockData/distribution";

const STATUS_TONE: Record<RestrictionRow["status"], PillTone> = {
  "In sync": "success",
  "Pending push": "warning",
  Blocked: "error",
};

function boolLabel(v: boolean): string {
  return v ? "Yes" : "No";
}

const columns: DataTableColumn<RestrictionRow>[] = [
  { key: "pid", label: "Property", render: (r) => propName(r.pid) },
  { key: "rpId", label: "Rate plan", render: (r) => ratePlanById(r.rpId)?.eqName ?? r.rpId },
  { key: "minArr", label: "Min stay (arrival)", align: "right", render: (r) => r.minArr },
  { key: "minThr", label: "Min stay (through)", align: "right", render: (r) => r.minThr },
  { key: "maxStay", label: "Max stay", align: "right", render: (r) => r.maxStay },
  { key: "cta", label: "CTA", render: (r) => boolLabel(r.cta) },
  { key: "ctd", label: "CTD", render: (r) => boolLabel(r.ctd) },
  { key: "stopSell", label: "Stop sell", render: (r) => boolLabel(r.stopSell) },
  { key: "status", label: "Status", render: (r) => <Pill label={r.status} tone={STATUS_TONE[r.status]} /> },
];

export function Restrictions() {
  return (
    <div>
      <PageHeader title="Restrictions" description="Min stay, max stay, CTA / CTD and stop sell" />
      <MockDataNotice />
      <div className="card">
        <DataTable columns={columns} rows={restrictionRows} getRowKey={(r) => r.id} />
      </div>
    </div>
  );
}
