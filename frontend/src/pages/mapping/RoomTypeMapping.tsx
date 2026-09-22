import { useEffect, useState } from "react";
import { useCurrentPropertyId } from "../../auth/useCurrentProperty";
import { extractErrorMessage } from "../../api/client";
import { getRoomTypes, onboardRoomTypes } from "../../api/gqApi";
import { RoomTypeSummary } from "../../api/types";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { useToast } from "../../components/toast/ToastContext";

/**
 * GQ's real backend has no separate "map an EQ room type to an existing Channex room
 * type" step - POST /room-types/onboard creates a brand new Channex room type and maps
 * it in the same call (see roomType.service.ts onboardRoomTypes). So this page shows
 * room types not yet onboarded and offers the one real action that exists: onboard them.
 */
export function RoomTypeMapping() {
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
      const types = await getRoomTypes(propertyId);
      setRows(types.filter((t) => !t.channex.onboarded));
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
      toast(newlyOnboarded > 0 ? `Onboarded ${newlyOnboarded} room type(s) to Channex.` : "Nothing left to onboard.");
      await load();
    } catch (err) {
      toast(extractErrorMessage(err), "err");
    } finally {
      setOnboarding(false);
    }
  }

  const columns: DataTableColumn<RoomTypeSummary>[] = [
    { key: "name", label: "BQ room type", render: (r) => r.name },
    { key: "occ", label: "Occupancy", align: "right", render: (r) => r.maxOccupancy },
    { key: "count", label: "Physical rooms", align: "right", render: (r) => r.totalRooms },
    { key: "status", label: "Status", render: () => <Pill label="Unmapped" tone="warning" /> },
  ];

  if (propertyId === null) {
    return (
      <div>
        <PageHeader title="Room Type Mapping" description="Room types not yet onboarded to Channex" />
        <div className="card">
          <p className="muted">Your account has no assigned property, so there is nothing to load here.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Room Type Mapping"
        description="Room types not yet onboarded to Channex"
        actions={
          <button type="button" className="button button--primary" onClick={handleOnboardAll} disabled={onboarding || rows.length === 0}>
            {onboarding ? "Onboarding…" : `Onboard all (${rows.length})`}
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
          emptyMessage={loading ? "Loading…" : "Every room type is already onboarded."}
        />
      </div>
    </div>
  );
}
