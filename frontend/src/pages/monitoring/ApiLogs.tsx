import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function ApiLogs() {
  return (
    <div>
      <PageHeader title="API Logs" description="Every request Gateway Quest makes to Channex" />
      <NotAvailableNotice />
    </div>
  );
}
