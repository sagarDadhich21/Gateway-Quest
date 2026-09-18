import { useState } from "react";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill, PillTone } from "../../components/Pill";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";
import { OtaChannelRow, otaChannels, propName } from "../../mockData/channexMiddleware";

const STATUS_TONE: Record<OtaChannelRow["status"], PillTone> = {
  Active: "success",
  Warning: "warning",
  "Not mapped": "neutral",
  Paused: "neutral",
};

export function OtaChannels() {
  const [rows, setRows] = useState<OtaChannelRow[]>(otaChannels);
  const { confirm } = useModal();
  const toast = useToast();

  function togglePause(c: OtaChannelRow) {
    if (c.status === "Paused") {
      setRows((prev) => prev.map((r) => (r.id === c.id ? { ...r, status: "Active" } : r)));
      toast(`${c.name} reactivated`);
      return;
    }
    confirm(
      `Pause ${c.name}?`,
      "Channex stops sending rates and availability to this OTA. Existing bookings still arrive.",
      () => {
        setRows((prev) => prev.map((r) => (r.id === c.id ? { ...r, status: "Paused" } : r)));
        toast(`${c.name} paused`, "warn");
      },
      true
    );
  }

  const columns: DataTableColumn<OtaChannelRow>[] = [
    { key: "name", label: "Channel", render: (r) => r.name },
    { key: "pid", label: "Property", render: (r) => propName(r.pid) },
    { key: "status", label: "Status", render: (r) => <Pill label={r.status} tone={STATUS_TONE[r.status]} /> },
    { key: "mapping", label: "Mapping coverage", render: (r) => `${r.mappedRooms} / ${r.totalRooms} rooms` },
    { key: "lastSync", label: "Last sync", render: (r) => r.lastSync },
    { key: "bookings30d", label: "Bookings (30d)", align: "right", render: (r) => r.bookings30d },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) =>
        r.status === "Not mapped" ? (
          <span className="muted">—</span>
        ) : (
          <button type="button" className="button button--ghost" onClick={() => togglePause(r)}>
            {r.status === "Paused" ? "Activate" : "Pause"}
          </button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="OTA Channels" description="OTA connections that Channex distributes to" />
      <MockDataNotice />
      <div className="card">
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
      </div>
    </div>
  );
}
