import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function WebhookLog() {
  return (
    <div>
      <PageHeader title="Webhook Log" description="Inbound Channex webhooks and retry backoff" />
      <NotAvailableNotice />
    </div>
  );
}
