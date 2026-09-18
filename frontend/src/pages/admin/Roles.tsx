import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { AdminRoleRow, adminRoles } from "../../mockData/admin";

const columns: DataTableColumn<AdminRoleRow>[] = [
  { key: "role", label: "Role", render: (r) => <strong>{r.role}</strong> },
  { key: "pages", label: "Panel access", render: (r) => r.pages },
  { key: "write", label: "Write access", render: (r) => r.write },
];

export function AdminRoles() {
  return (
    <div>
      <PageHeader title="Roles" description="What each role can read and write" />
      <MockDataNotice />
      <div className="card">
        <DataTable columns={columns} rows={adminRoles} getRowKey={(r) => r.role} />
      </div>
    </div>
  );
}
