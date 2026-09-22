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

export function ChannexRatePlans() {
  const propertyId = useCurrentPropertyId();
  const [rows, setRows] = useState<RatePlan[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showModal, confirm, closeModal } = useModal();
  const toast = useToast();

  async function load() {
    if (propertyId === null) return;
    setLoading(true);
    setError(null);
    try {
      const [plans, types] = await Promise.all([listRatePlans(propertyId), getRoomTypes(propertyId)]);
      setRows(plans);
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

  function openCreate() {
    if (propertyId === null) return;
    const pid = propertyId;
    const onboardedRoomTypes = roomTypes.filter((rt) => rt.channex.onboarded);

    if (onboardedRoomTypes.length === 0) {
      toast("Onboard at least one room type to Channex first (Channex Room Types page).", "warn");
      return;
    }

    let name = "";
    let roomTypeId = onboardedRoomTypes[0].id;
    let occupancy = onboardedRoomTypes[0].maxOccupancy;
    let creating = false;

    function rerender() {
      const selectedRoomType = roomTypes.find((rt) => rt.id === roomTypeId);
      showModal({
        title: "Create rate plan",
        body: (
          <>
            <label>Room type</label>
            <select
              value={roomTypeId}
              onChange={(e) => {
                roomTypeId = Number(e.target.value);
                const rt = roomTypes.find((r) => r.id === roomTypeId);
                occupancy = rt?.maxOccupancy ?? occupancy;
                rerender();
              }}
            >
              {onboardedRoomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name}
                </option>
              ))}
            </select>

            <label>Name</label>
            <input
              type="text"
              placeholder="e.g. Standard Rate"
              value={name}
              onChange={(e) => {
                name = e.target.value;
                rerender();
              }}
            />

            <label>Occupancy (max {selectedRoomType?.maxOccupancy ?? "—"})</label>
            <input
              type="number"
              min={1}
              max={selectedRoomType?.maxOccupancy}
              value={occupancy}
              onChange={(e) => {
                occupancy = Number(e.target.value);
                rerender();
              }}
            />
          </>
        ),
        foot: (
          <>
            <button type="button" className="button button--ghost" onClick={closeModal}>
              Cancel
            </button>
            <button
              type="button"
              className="button button--primary"
              disabled={creating}
              onClick={async () => {
                if (!name.trim()) {
                  toast("Name is required.", "warn");
                  return;
                }
                creating = true;
                rerender();
                try {
                  await createRatePlan({
                    propertyId: pid,
                    roomTypeId,
                    name: name.trim(),
                    options: [{ occupancy, isPrimary: true }],
                  });
                  closeModal();
                  toast(`Rate plan "${name.trim()}" created and onboarded to Channex.`);
                  await load();
                } catch (err) {
                  creating = false;
                  toast(extractErrorMessage(err), "err");
                  rerender();
                }
              }}
            >
              {creating ? "Creating…" : "Create & onboard"}
            </button>
          </>
        ),
      });
    }

    rerender();
  }

  function handleDelete(row: RatePlan) {
    confirm(
      `Delete "${row.name}"?`,
      "This removes the rate plan from GQ. The Channex-side rate plan (if any) is left in place.",
      async () => {
        try {
          await deleteRatePlan(row.id);
          toast(`Deleted "${row.name}".`);
          await load();
        } catch (err) {
          toast(extractErrorMessage(err), "err");
        }
      },
      true
    );
  }

  const columns: DataTableColumn<RatePlan>[] = [
    { key: "name", label: "Rate plan", render: (r) => r.name },
    { key: "roomType", label: "Room type", render: (r) => roomTypeName(r.roomTypeId) },
    { key: "sellMode", label: "Sell mode", render: (r) => <code>{r.sellMode}</code> },
    { key: "occ", label: "Occupancy", align: "right", render: (r) => r.options.map((o) => o.occupancy).join(", ") },
    {
      key: "mapped",
      label: "Channex",
      render: (r) =>
        r.channex.onboarded ? <Pill label="Onboarded" tone="success" /> : <Pill label="Not onboarded" tone="warning" />,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) => (
        <button type="button" className="button button--danger" onClick={() => handleDelete(r)}>
          Delete
        </button>
      ),
    },
  ];

  if (propertyId === null) {
    return (
      <div>
        <PageHeader title="Channex Rate Plans" description="Rate plans that carry rates and restrictions" />
        <div className="card">
          <p className="muted">Your account has no assigned property, so there is nothing to load here.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Channex Rate Plans"
        description="Live from GQ — rate plans that carry rates and restrictions"
        actions={
          <button type="button" className="button button--primary" onClick={openCreate}>
            Create rate plan
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
          getRowKey={(r) => r.id}
          emptyMessage={loading ? "Loading…" : "No rate plans yet."}
        />
      </div>
    </div>
  );
}
