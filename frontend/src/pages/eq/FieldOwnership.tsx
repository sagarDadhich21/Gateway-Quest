import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function FieldOwnership() {
  return (
    <div>
      <PageHeader
        title="Field Ownership"
        description="Which system owns each ARI field, and when Gateway Quest holds it back"
      />
      <NotAvailableNotice />
    </div>
  );
}
