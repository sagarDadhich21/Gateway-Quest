import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function InboundAriStatus() {
  return (
    <div>
      <PageHeader
        title="Inbound ARI Status"
        description="Read-only — shows what Enterprise Quest sent and whether it has been forwarded to Channex"
      />
      <NotAvailableNotice />
    </div>
  );
}
