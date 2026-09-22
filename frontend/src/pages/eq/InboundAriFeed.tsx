import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function InboundAriFeed() {
  return (
    <div>
      <PageHeader title="Inbound ARI Feed" description="Rates, availability and restrictions pushed from Enterprise Quest (EQ)" />
      <NotAvailableNotice />
    </div>
  );
}
