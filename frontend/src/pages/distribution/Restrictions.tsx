import { useState } from "react";
import { useCurrentPropertyId } from "../../auth/useCurrentProperty";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";
import { defaultDateRange } from "../../lib/dateRange";
import { displayDate } from "../../lib/format";
import { RestrictionRow } from "../../api/types";
import { buildRestrictionModal, emptyRestrictionForm, RestrictionFormValues } from "./PushRestrictionModal";
import { useRestrictionsData } from "./useRestrictionsData";

function boolLabel(v: boolean): string {
  return v ? "Yes" : "No";
}

export function Restrictions() {
  const propertyId = useCurrentPropertyId();
  const [range] = useState(defaultDateRange());
  const { ratePlans, restrictions, loading, error, reload } = useRestrictionsData(propertyId, range.dateFrom, range.dateTo);
  const { showModal, closeModal } = useModal();
  const toast = useToast();

  function ratePlanName(id: string): string {
    return ratePlans.find((rp) => rp.id === id)?.name ?? id;
  }

  function openPushModal() {
    if (propertyId === null) return;
    if (!ratePlans.length) {
      toast("No rate plans yet — create one first.", "warn");
      return;
    }
    let form: RestrictionFormValues = emptyRestrictionForm(
      ratePlans.find((rp) => rp.channex.onboarded)?.id ?? ratePlans[0].id,
      range.dateFrom
    );
    let submitting = false;

    function rerender() {
      showModal(
        buildRestrictionModal({
          form,
          ratePlans,
          propertyId: propertyId as number,
          submitting,
          setForm: (f) => {
            form = f;
          },
          setSubmitting: (v) => {
            submitting = v;
          },
          onSuccess: () => {
            closeModal();
            toast("Restriction pushed to Channex.");
            void reload();
          },
          onError: (message) => {
            toast(message, "err");
            rerender();
          },
          onClose: closeModal,
          rerender,
        })
      );
    }

    rerender();
  }

  const columns: DataTableColumn<RestrictionRow>[] = [
    { key: "rpId", label: "Rate plan", render: (r) => ratePlanName(r.ratePlanId) },
    { key: "date", label: "Date", render: (r) => displayDate(r.date) },
    { key: "minStay", label: "Min stay", align: "right", render: (r) => r.minStay ?? "—" },
    { key: "maxStay", label: "Max stay", align: "right", render: (r) => r.maxStay ?? "—" },
    { key: "cta", label: "CTA", render: (r) => boolLabel(r.closedToArrival) },
    { key: "ctd", label: "CTD", render: (r) => boolLabel(r.closedToDeparture) },
    { key: "stopSell", label: "Stop sell", render: (r) => boolLabel(r.stopSell) },
  ];

  if (propertyId === null) {
    return (
      <div>
        <PageHeader title="Restrictions" description="Min stay, max stay, CTA / CTD and stop sell" />
        <div className="card">
          <p className="muted">Your account has no assigned property, so there is nothing to load here.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Restrictions"
        description={`Live from GQ — ${displayDate(range.dateFrom)} to ${displayDate(range.dateTo)}`}
        actions={
          <button type="button" className="button button--primary" onClick={openPushModal}>
            Push restriction
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
          rows={restrictions}
          getRowKey={(r) => `${r.ratePlanId}|${r.date}`}
          emptyMessage={loading ? "Loading…" : "No restrictions pushed for this range yet."}
        />
      </div>
    </div>
  );
}
