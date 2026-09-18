import { useMemo, useState } from "react";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill, PillTone } from "../../components/Pill";
import { Tabs } from "../../components/Tabs";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";
import { propById, propName } from "../../mockData/channexMiddleware";
import { BookingRevisionRow, bookingRevisions } from "../../mockData/bookings";
import { EQ } from "../../mockData/core";
import { money } from "../../lib/format";

const STATUS_TONE: Record<BookingRevisionRow["status"], PillTone> = {
  new: "info",
  modified: "purple",
  cancelled: "error",
};

const TAB_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Unacknowledged", value: "unacked" },
  { label: "New", value: "new" },
  { label: "Modified", value: "modified" },
  { label: "Cancelled", value: "cancelled" },
];

export function BookingRevisions() {
  const [rows, setRows] = useState<BookingRevisionRow[]>(bookingRevisions);
  const [tab, setTab] = useState("all");
  const { confirm } = useModal();
  const toast = useToast();

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    if (tab === "unacked") return rows.filter((r) => !r.acked);
    return rows.filter((r) => r.status === tab);
  }, [tab, rows]);

  function ackOne(row: BookingRevisionRow) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, acked: true } : r)));
    toast(`${row.bookingId} acknowledged to Channex`);
  }

  function ackAll() {
    const deliverable = rows.filter((r) => !r.acked && !r.err);
    if (!deliverable.length) {
      toast("Nothing deliverable to acknowledge.", "warn");
      return;
    }
    confirm(
      `Acknowledge ${deliverable.length} revision(s)?`,
      `Each one is written to ${EQ.name} first, then acknowledged to Channex individually — Channex has no batch-acknowledge endpoint.`,
      () => {
        setRows((prev) => prev.map((r) => (!r.acked && !r.err ? { ...r, acked: true } : r)));
        toast(`Acknowledged ${deliverable.length} revision(s)`);
      }
    );
  }

  const columns: DataTableColumn<BookingRevisionRow>[] = [
    { key: "bookingId", label: "Booking", render: (r) => <code>{r.bookingId}</code> },
    { key: "ota", label: "OTA", render: (r) => r.ota },
    { key: "pid", label: "Property", render: (r) => propName(r.pid) },
    { key: "guest", label: "Guest", render: (r) => r.guest },
    { key: "status", label: "Status", render: (r) => <Pill label={r.status} tone={STATUS_TONE[r.status]} /> },
    { key: "arrival", label: "Arrival", render: (r) => r.arrival },
    { key: "amount", label: "Amount", align: "right", render: (r) => money(r.amount, propById(r.pid)?.currency) },
    {
      key: "acked",
      label: "Ack",
      render: (r) =>
        r.acked ? (
          <span className="muted">Yes</span>
        ) : (
          <div>
            <button type="button" className="button button--ghost" disabled={!!r.err} onClick={() => ackOne(r)}>
              Acknowledge
            </button>
            {r.err && <div className="form-error table-subtext">{r.err}</div>}
          </div>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Booking Revisions"
        description="Channex booking feed — acknowledge once saved in EQ"
        actions={<button type="button" className="button button--primary" onClick={ackAll}>Acknowledge all deliverable</button>}
      />
      <MockDataNotice />
      <div className="card">
        <Tabs options={TAB_OPTIONS} active={tab} onChange={setTab} />
        <DataTable columns={columns} rows={filtered} getRowKey={(r) => r.id} />
      </div>
    </div>
  );
}
