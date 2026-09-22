import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function ChannexTasks() {
  return (
    <div>
      <PageHeader title="Channex Tasks" description="Task IDs returned by ARI writes, with warnings" />
      <NotAvailableNotice />
    </div>
  );
}
