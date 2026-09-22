import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function AdminRoles() {
  return (
    <div>
      <PageHeader title="Roles" description="What each role can read and write" />
      <NotAvailableNotice />
    </div>
  );
}
