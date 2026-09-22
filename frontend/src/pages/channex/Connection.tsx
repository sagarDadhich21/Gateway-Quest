import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function Connection() {
  return (
    <div>
      <PageHeader title="Channex Connection" description="API key, base URL, rate limits and webhook registration" />
      <NotAvailableNotice />
    </div>
  );
}
