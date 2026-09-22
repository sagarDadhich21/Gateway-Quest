import { useState } from "react";
import { useCurrentPropertyId } from "../../auth/useCurrentProperty";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";
import { defaultDateRange } from "../../lib/dateRange";
import { displayDate, money } from "../../lib/format";
import { RestrictionRow } from "../../api/types";
import { buildRestrictionModal, emptyRestrictionForm, RestrictionFormValues } from "./PushRestrictionModal";
import { useRestrictionsData } from "./useRestrictionsData";

export function RatesPush() {
  const propertyId = useCurrentPropertyId();
  const [range] = useState(defaultDateRange());
  const { ratePlans, restrictions, loading, error, reload } = useRestrictionsData(propertyId, range.dateFrom, range.dateTo);
  const { showModal, closeModal } = useModal();
  const toast = useToast();

  function ratePlanName(id: string): string {
    return ratePlans.find((rp) => rp.id === id)?.name ?? id;
  }
  function ratePlanCurrency(id: string): string | null {
    return ratePlans.find((rp) => rp.id === id)?.currency ?? null;
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
            toast("Rate pushed to Channex.");
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
    { key: "rate", label: "Rate", align: "right", render: (r) => money(r.rate, ratePlanCurrency(r.ratePlanId)) },
    { key: "updatedAt", label: "Last pushed", render: (r) => new Date(r.updatedAt).toLocaleString() },
  ];

  if (propertyId === null) {
    return (
      <div>
        <PageHeader title="Rates Push" description="POST /ari/restrictions — rate values at rate-plan level" />
        <div className="card">
          <p className="muted">Your account has no assigned property, so there is nothing to load here.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Rates Push"
        description={`POST /ari/restrictions — ${displayDate(range.dateFrom)} to ${displayDate(range.dateTo)}, rate value at rate-plan level`}
        actions={
          <button type="button" className="button button--primary" onClick={openPushModal}>
            Push rate
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
          emptyMessage={loading ? "Loading…" : "No rates pushed for this range yet."}
        />
      </div>
    </div>
  );
}
