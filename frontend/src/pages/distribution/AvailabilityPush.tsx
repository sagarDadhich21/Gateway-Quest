import { useEffect, useState } from "react";
import { useCurrentPropertyId } from "../../auth/useCurrentProperty";
import { extractErrorMessage } from "../../api/client";
import { getAri, getAriAvailability, getRoomTypes, pushAvailability } from "../../api/gqApi";
import { DailyAvailabilityRow, RoomTypeSummary } from "../../api/types";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pill, PillTone } from "../../components/Pill";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";
import { defaultDateRange } from "../../lib/dateRange";
import { displayDate } from "../../lib/format";

interface Row extends DailyAvailabilityRow {
  cxValue: number | null;
  status: "In sync" | "Pending push" | "Blocked";
}

export function AvailabilityPush() {
  const propertyId = useCurrentPropertyId();
  const [range] = useState(defaultDateRange());
  const [roomTypes, setRoomTypes] = useState<RoomTypeSummary[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showModal, confirm, closeModal } = useModal();
  const toast = useToast();

  async function load() {
    if (propertyId === null) return;
    setLoading(true);
    setError(null);
    try {
      const [types, live, snapshot] = await Promise.all([
        getRoomTypes(propertyId),
        getAriAvailability(propertyId, range.dateFrom, range.dateTo),
        getAri(propertyId, range.dateFrom, range.dateTo),
      ]);
      setRoomTypes(types);

      const snapshotByKey = new Map(snapshot.availability.map((a) => [`${a.roomTypeId}|${a.date}`, a.availableRooms]));
      const typeById = new Map(types.map((t) => [t.id, t]));

      setRows(
        live.map((l) => {
          const cxValue = snapshotByKey.get(`${l.roomTypeId}|${l.date}`) ?? null;
          const onboarded = typeById.get(l.roomTypeId)?.channex.onboarded ?? false;
          return {
            ...l,
            cxValue,
            status: !onboarded ? "Blocked" : cxValue === l.availableRooms ? "In sync" : "Pending push",
          };
        })
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  function roomTypeName(id: number): string {
    return roomTypes.find((rt) => rt.id === id)?.name ?? `#${id}`;
  }

  const ready = rows.filter((r) => r.status === "Pending push");

  function previewBatch() {
    const payload = { values: ready.map((r) => ({ roomTypeId: r.roomTypeId, date: r.date, availability: r.availableRooms })) };
    showModal({
      title: "Preview batch — POST /ari/availability",
      wide: true,
      body: <pre className="mono small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(payload, null, 2)}</pre>,
      foot: <button type="button" className="button button--ghost" onClick={closeModal}>Close</button>,
    });
  }

  function pushAll() {
    if (propertyId === null) return;
    if (!ready.length) {
      toast("Nothing ready to push.", "warn");
      return;
    }
    confirm(
      `Push ${ready.length} row(s) to Channex?`,
      "This pushes real BQ availability for these room type/date rows straight to Channex.",
      async () => {
        setPushing(true);
        try {
          const result = await pushAvailability(propertyId, {
            values: ready.map((r) => ({ roomTypeId: r.roomTypeId, date: r.date, availability: r.availableRooms })),
          });
          toast(
            result.verified
              ? `Pushed and confirmed ${ready.length} row(s) on Channex.`
              : `Pushed ${ready.length} row(s) — Channex hasn't confirmed the values back yet.`,
            result.verified ? "ok" : "warn"
          );
          await load();
        } catch (err) {
          toast(extractErrorMessage(err), "err");
        } finally {
          setPushing(false);
        }
      }
    );
  }

  const STATUS_TONE: Record<Row["status"], PillTone> = { "In sync": "success", "Pending push": "warning", Blocked: "error" };

  const columns: DataTableColumn<Row>[] = [
    { key: "rt", label: "Room type", render: (r) => roomTypeName(r.roomTypeId) },
    { key: "date", label: "Date", render: (r) => displayDate(r.date) },
    { key: "total", label: "Total rooms", align: "right", render: (r) => r.totalRooms },
    { key: "eqValue", label: "BQ availability", align: "right", render: (r) => r.availableRooms },
    { key: "cxValue", label: "Last known on Channex", align: "right", render: (r) => r.cxValue ?? "—" },
    { key: "status", label: "Status", render: (r) => <Pill label={r.status} tone={STATUS_TONE[r.status]} /> },
  ];

  if (propertyId === null) {
    return (
      <div>
        <PageHeader title="Availability Push" description="POST /ari/availability — batched per property, room-type level" />
        <div className="card">
          <p className="muted">Your account has no assigned property, so there is nothing to load here.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Availability Push"
        description={`POST /ari/availability — ${displayDate(range.dateFrom)} to ${displayDate(range.dateTo)}, room-type level`}
        actions={
          <>
            <button type="button" className="button button--ghost" onClick={previewBatch} disabled={!ready.length}>
              Preview batch
            </button>
            <button type="button" className="button button--primary" onClick={pushAll} disabled={pushing || !ready.length}>
              {pushing ? "Pushing…" : `Push all ready (${ready.length})`}
            </button>
          </>
        }
      />
      {error && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">{error}</p>
        </div>
      )}
      <div className="card">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => `${r.roomTypeId}|${r.date}`}
          emptyMessage={loading ? "Loading…" : "No availability data for this range."}
        />
      </div>
    </div>
  );
}
