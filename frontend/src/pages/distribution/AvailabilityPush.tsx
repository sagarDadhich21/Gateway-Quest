import { useState } from "react";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { MockDataNotice } from "../../components/MockDataNotice";
import { PageHeader } from "../../components/PageHeader";
import { Pill, PillTone } from "../../components/Pill";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";
import { propById, propName, roomTypeById } from "../../mockData/channexMiddleware";
import { AvailabilityPushRow, availabilityPushRows } from "../../mockData/distribution";

const STATUS_TONE: Record<AvailabilityPushRow["status"], PillTone> = {
  "In sync": "success",
  "Pending push": "warning",
  Blocked: "error",
};

export function AvailabilityPush() {
  const [rows, setRows] = useState<AvailabilityPushRow[]>(availabilityPushRows);
  const { showModal, confirm, closeModal } = useModal();
  const toast = useToast();

  const ready = rows.filter((r) => r.status === "Pending push");

  function previewBatch() {
    const payload = {
      values: ready.map((r) => ({
        property_id: propById(r.pid)?.cxId ?? "<not onboarded>",
        room_type_id: roomTypeById(r.rtId)?.cxId ?? "<not mapped>",
        date_from: r.dateFrom,
        date_to: r.dateTo,
        availability: r.eqValue,
      })),
    };
    showModal({
      title: "Preview batch — POST /availability",
      wide: true,
      body: (
        <pre className="mono small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {JSON.stringify(payload, null, 2)}
        </pre>
      ),
      foot: <button type="button" className="button button--ghost" onClick={closeModal}>Close</button>,
    });
  }

  function pushAll() {
    if (!ready.length) {
      toast("Nothing ready to push.", "warn");
      return;
    }
    confirm(
      `Push ${ready.length} row(s) to Channex?`,
      "This sends every ready row straight to Channex, which fans it out to every mapped OTA channel immediately.",
      () => {
        setRows((prev) => prev.map((r) => (r.status === "Pending push" ? { ...r, status: "In sync", cxValue: r.eqValue } : r)));
        toast(`Pushed ${ready.length} row(s) to Channex`);
      }
    );
  }

  const columns: DataTableColumn<AvailabilityPushRow>[] = [
    { key: "pid", label: "Property", render: (r) => propName(r.pid) },
    { key: "rtId", label: "Room type", render: (r) => roomTypeById(r.rtId)?.eqName ?? r.rtId },
    { key: "dateFrom", label: "From", render: (r) => r.dateFrom },
    { key: "dateTo", label: "To", render: (r) => r.dateTo },
    { key: "eqValue", label: "EQ value", align: "right", render: (r) => r.eqValue },
    { key: "cxValue", label: "Channex value", align: "right", render: (r) => r.cxValue ?? "—" },
    { key: "status", label: "Status", render: (r) => <Pill label={r.status} tone={STATUS_TONE[r.status]} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Availability Push"
        description="POST /availability — batched per property, room-type level"
        actions={
          <>
            <button type="button" className="button button--ghost" onClick={previewBatch}>Preview batch</button>
            <button type="button" className="button button--primary" onClick={pushAll}>Push all ready ({ready.length})</button>
          </>
        }
      />
      <MockDataNotice />
      <div className="card">
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
      </div>
    </div>
  );
}
