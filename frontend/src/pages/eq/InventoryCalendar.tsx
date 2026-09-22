import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function InventoryCalendar() {
  return (
    <div>
      <PageHeader
        title="Inventory Calendar"
        description="Read-only — rate and availability for every room type, by day"
      />
      <NotAvailableNotice />
    </div>
  );
}
