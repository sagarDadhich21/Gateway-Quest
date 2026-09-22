import { NotAvailableNotice } from "../../components/NotAvailableNotice";
import { PageHeader } from "../../components/PageHeader";

export function OtaChannels() {
  return (
    <div>
      <PageHeader title="OTA Channels" description="OTA connections that Channex distributes to" />
      <NotAvailableNotice />
    </div>
  );
}
