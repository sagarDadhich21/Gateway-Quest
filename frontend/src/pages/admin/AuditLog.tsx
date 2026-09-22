import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function AuditLog() {
  return (
    <div>
      <PageHeader title="Audit Log" description="Every inbound message, decision and push" />
      <NotAvailableNotice />
    </div>
  );
}
