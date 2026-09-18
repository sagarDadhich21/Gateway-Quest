import { Link } from "react-router-dom";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { ChannexRoomTypeRow, channexRoomTypes, propName } from "../../mockData/channexMiddleware";

const columns: DataTableColumn<ChannexRoomTypeRow>[] = [
  { key: "pid", label: "Property", render: (r) => propName(r.pid) },
  { key: "eqName", label: "EQ room type", render: (r) => r.eqName },
  { key: "cxTitle", label: "Channex title", render: (r) => r.cxTitle ?? <span className="muted">—</span> },
  { key: "occ", label: "Occupancy", align: "right", render: (r) => r.occ },
  { key: "count", label: "Physical rooms", align: "right", render: (r) => r.count },
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
        <Link className="button button--ghost" to="/mapping/room-types">
          Map now →
        </Link>
      ),
  },
];

export function ChannexRoomTypes() {
  return (
    <div>
      <PageHeader title="Channex Room Types" description="Room types that carry availability (room-type level)" />
      <MockDataNotice />
      <div className="card">
        <DataTable columns={columns} rows={channexRoomTypes} getRowKey={(r) => r.id} />
      </div>
    </div>
  );
}
