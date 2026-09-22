import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function AdminUsers() {
  return (
    <div>
      <PageHeader title="Users" description="Platform access" />
      <NotAvailableNotice />
    </div>
  );
}
