import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function BookingRevisions() {
  return (
    <div>
      <PageHeader title="Booking Revisions" description="Channex booking feed — acknowledge once saved in EQ" />
      <NotAvailableNotice />
    </div>
  );
}
