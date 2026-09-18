import { Link } from "react-router-dom";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { ChannexRatePlanRow, channexRatePlans, propName, roomTypeById } from "../../mockData/channexMiddleware";

const columns: DataTableColumn<ChannexRatePlanRow>[] = [
  { key: "pid", label: "Property", render: (r) => propName(r.pid) },
  { key: "eqName", label: "Rate plan", render: (r) => r.eqName },
  { key: "rtId", label: "Room type", render: (r) => roomTypeById(r.rtId)?.eqName ?? r.rtId },
  { key: "sellMode", label: "Sell mode", render: (r) => <code>{r.sellMode}</code> },
  { key: "occ", label: "Occupancy", align: "right", render: (r) => r.occ },
  {
    key: "mapped",
    label: "Mapped",
    render: (r) => (r.mapped ? <Pill label="Mapped" tone="success" /> : <Pill label="Unmapped" tone="warning" />),
  },
  {
    key: "actions",
    label: "",
    align: "right",
    render: (r) =>
      r.mapped ? null : (
        <Link className="button button--ghost" to="/mapping/rate-plans">
          Map now →
        </Link>
      ),
  },
];

export function ChannexRatePlans() {
  return (
    <div>
      <PageHeader title="Channex Rate Plans" description="Rate plans that carry rates and restrictions" />
      <MockDataNotice />
      <div className="card">
        <DataTable columns={columns} rows={channexRatePlans} getRowKey={(r) => r.id} />
      </div>
    </div>
  );
}
