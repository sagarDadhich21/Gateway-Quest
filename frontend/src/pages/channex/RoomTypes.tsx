import { useEffect, useState } from "react";
import { useCurrentPropertyId } from "../../auth/useCurrentProperty";
import { extractErrorMessage } from "../../api/client";
import { getRoomTypes, onboardRoomTypes } from "../../api/gqApi";
import { RoomTypeSummary } from "../../api/types";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { useToast } from "../../components/toast/ToastContext";

export function ChannexRoomTypes() {
  const propertyId = useCurrentPropertyId();
  const [rows, setRows] = useState<RoomTypeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function load() {
    if (propertyId === null) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await getRoomTypes(propertyId));
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

  async function handleOnboardAll() {
    if (propertyId === null) return;
    setOnboarding(true);
    try {
      const results = await onboardRoomTypes(propertyId);
      const newlyOnboarded = results.filter((r) => r.status === "onboarded").length;
      toast(
        newlyOnboarded > 0
          ? `Onboarded ${newlyOnboarded} room type(s) to Channex.`
          : "All room types were already onboarded."
      );
      await load();
    } catch (err) {
      toast(extractErrorMessage(err), "err");
    } finally {
      setOnboarding(false);
    }
  }

  const columns: DataTableColumn<RoomTypeSummary>[] = [
    { key: "name", label: "BQ room type", render: (r) => r.name },
    { key: "maxOcc", label: "Occupancy", align: "right", render: (r) => r.maxOccupancy },
    { key: "count", label: "Physical rooms", align: "right", render: (r) => r.totalRooms },
    {
      key: "mapped",
      label: "Channex",
      render: (r) =>
        r.channex.onboarded ? (
          <Pill label="Onboarded" tone="success" />
        ) : (
          <Pill label="Not onboarded" tone="warning" />
        ),
    },
    {
      key: "cxId",
      label: "Channex room_type_id",
      render: (r) => (r.channex.roomTypeId ? <code>{r.channex.roomTypeId}</code> : <span className="muted">—</span>),
    },
  ];

  if (propertyId === null) {
    return (
      <div>
        <PageHeader title="Channex Room Types" description="Room types that carry availability (room-type level)" />
        <div className="card">
          <p className="muted">Your account has no assigned property, so there is nothing to load here.</p>
        </div>
      </div>
    );
  }

  const unmappedCount = rows.filter((r) => !r.channex.onboarded).length;

  return (
    <div>
      <PageHeader
        title="Channex Room Types"
        description="Live from BQ — room types that carry availability (room-type level)"
        actions={
          <button type="button" className="button button--primary" onClick={handleOnboardAll} disabled={onboarding || unmappedCount === 0}>
            {onboarding ? "Onboarding…" : `Onboard all unmapped (${unmappedCount})`}
          </button>
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
          getRowKey={(r) => String(r.id)}
          emptyMessage={loading ? "Loading…" : "No room types found."}
        />
      </div>
    </div>
  );
}
