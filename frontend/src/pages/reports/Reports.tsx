import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function Reports() {
  return (
    <div>
      <PageHeader title="Reports" description="Operational and management reporting across the pipeline" />
      <NotAvailableNotice />
    </div>
  );
}
