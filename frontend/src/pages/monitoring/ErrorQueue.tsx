import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function ErrorQueue() {
  return (
    <div>
      <PageHeader title="Error Queue" description="Failed pushes, rate limits and validation rejections" />
      <NotAvailableNotice />
    </div>
  );
}
