import { useEffect, useState } from "react";
import { useCurrentPropertyId } from "../../auth/useCurrentProperty";
import { extractErrorMessage } from "../../api/client";
import { createRatePlan, deleteRatePlan, getRoomTypes, listRatePlans } from "../../api/gqApi";
import { RatePlan, RoomTypeSummary } from "../../api/types";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";

/**
 * GQ's real backend has no separate "map an existing rate plan to Channex" step - a
 * rate plan is created and onboarded to Channex in the same POST /rate-plans call
 * (see ratePlan.service.ts createRatePlan). Calling that endpoint again for a rate
 * plan that already exists locally just returns the existing row unchanged (idempotent
 * by room type + name) - it never retries the Channex push. So the only way to onboard
 * a rate plan that's stuck without a cx_rate_plan_id is to delete it and recreate it
 * with the same fields, which is what this page's "Re-onboard" action actually does.
 */
export function RatePlanMapping() {
  const propertyId = useCurrentPropertyId();
  const [rows, setRows] = useState<RatePlan[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useModal();
  const toast = useToast();

  async function load() {
    if (propertyId === null) return;
    setLoading(true);
    setError(null);
    try {
      const [plans, types] = await Promise.all([listRatePlans(propertyId), getRoomTypes(propertyId)]);
      setRows(plans.filter((p) => !p.channex.onboarded));
      setRoomTypes(types);
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

  function reonboard(row: RatePlan) {
    const roomType = roomTypes.find((rt) => rt.id === row.roomTypeId);
    if (!roomType?.channex.onboarded) {
      toast(`${roomTypeName(row.roomTypeId)} must be onboarded to Channex before this rate plan can be.`, "warn");
      return;
    }

    confirm(
      `Re-onboard "${row.name}"?`,
      "GQ will delete this rate plan and recreate it with the same name/room type/options, onboarding it to Channex in the same call.",
      async () => {
        try {
          await deleteRatePlan(row.id);
          await createRatePlan({
            propertyId: row.propertyId,
            roomTypeId: row.roomTypeId,
            name: row.name,
            currency: row.currency,
            sellMode: row.sellMode as "per_room" | "per_person",
            rateMode: row.rateMode as "manual" | "derived" | "auto" | "cascade",
            mealType: row.mealType ?? undefined,
            isDefault: row.isDefault,
            options: row.options.map((o) => ({ occupancy: o.occupancy, isPrimary: o.isPrimary })),
          });
          toast(`"${row.name}" re-onboarded to Channex.`);
          await load();
        } catch (err) {
          toast(extractErrorMessage(err), "err");
        }
      }
    );
  }

  const columns: DataTableColumn<RatePlan>[] = [
    { key: "name", label: "Rate plan", render: (r) => r.name },
    { key: "roomType", label: "Room type", render: (r) => roomTypeName(r.roomTypeId) },
    { key: "status", label: "Status", render: () => <Pill label="Not onboarded" tone="warning" /> },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) => (
        <button type="button" className="button button--primary" onClick={() => reonboard(r)}>
          Re-onboard
        </button>
      ),
    },
  ];

  if (propertyId === null) {
    return (
      <div>
        <PageHeader title="Rate Plan Mapping" description="Rate plans not yet onboarded to Channex" />
        <div className="card">
          <p className="muted">Your account has no assigned property, so there is nothing to load here.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Rate Plan Mapping" description="Rate plans not yet onboarded to Channex" />
      <div className="mock-notice">
        GQ doesn't support a standalone "map to an existing Channex rate plan" step - onboarding always creates a
        new Channex rate plan at creation time. Rows here are stuck without one (e.g. their room type wasn't
        onboarded yet when they were created); "Re-onboard" deletes and recreates them to retry it.
      </div>
      {error && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">{error}</p>
        </div>
      )}
      <div className="card">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          emptyMessage={loading ? "Loading…" : "Every rate plan is already onboarded."}
        />
      </div>
    </div>
  );
}
