import { extractErrorMessage } from "../../api/client";
import { pushRestrictions } from "../../api/gqApi";
import { RatePlan } from "../../api/types";
import { ModalOptions } from "../../components/modal/ModalContext";

export interface RestrictionFormValues {
  ratePlanId: string;
  date: string;
  rate: string;
  minStay: string;
  maxStay: string;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  stopSell: boolean;
}

export function emptyRestrictionForm(ratePlanId: string, date: string): RestrictionFormValues {
  return { ratePlanId, date, rate: "", minStay: "", maxStay: "", closedToArrival: false, closedToDeparture: false, stopSell: false };
}

/**
 * Shared by Restrictions.tsx and RatesPush.tsx - builds one modal that pushes a single
 * date's restriction row via POST /ari/restrictions. Leaving "rate" blank lets the
 * backend fall back to pricing-service for that date (see ari.service.ts
 * pushRestrictions), rather than sending a default value that isn't real.
 */
export function buildRestrictionModal(opts: {
  form: RestrictionFormValues;
  ratePlans: RatePlan[];
  propertyId: number;
  submitting: boolean;
  setForm: (f: RestrictionFormValues) => void;
  setSubmitting: (v: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
  onClose: () => void;
  rerender: () => void;
}): ModalOptions {
  const { form, ratePlans, propertyId, submitting, setForm, setSubmitting, onSuccess, onError, onClose, rerender } = opts;

  async function submit() {
    setSubmitting(true);
    try {
      await pushRestrictions(propertyId, {
        ratePlanId: form.ratePlanId,
        values: [
          {
            date: form.date,
            rate: form.rate.trim() ? Number(form.rate) : undefined,
            minStay: form.minStay.trim() ? Number(form.minStay) : undefined,
            maxStay: form.maxStay.trim() ? Number(form.maxStay) : undefined,
            closedToArrival: form.closedToArrival,
            closedToDeparture: form.closedToDeparture,
            stopSell: form.stopSell,
          },
        ],
      });
      onSuccess();
    } catch (err) {
      onError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    title: "Push restriction — POST /ari/restrictions",
    wide: true,
    body: (
      <>
        <label>Rate plan</label>
        <select
          value={form.ratePlanId}
          onChange={(e) => {
            setForm({ ...form, ratePlanId: e.target.value });
            rerender();
          }}
        >
          {ratePlans.map((rp) => (
            <option key={rp.id} value={rp.id} disabled={!rp.channex.onboarded}>
              {rp.name}
              {!rp.channex.onboarded ? " (not onboarded)" : ""}
            </option>
          ))}
        </select>

        <label>Date</label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => {
            setForm({ ...form, date: e.target.value });
            rerender();
          }}
        />

        <label>Rate (major units — leave blank to use pricing-service)</label>
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder="e.g. 3999"
          value={form.rate}
          onChange={(e) => {
            setForm({ ...form, rate: e.target.value });
            rerender();
          }}
        />

        <label>Min stay (nights — applies on arrival and through the stay)</label>
        <input
          type="number"
          min={1}
          value={form.minStay}
          onChange={(e) => {
            setForm({ ...form, minStay: e.target.value });
            rerender();
          }}
        />

        <label>Max stay (nights)</label>
        <input
          type="number"
          min={1}
          value={form.maxStay}
          onChange={(e) => {
            setForm({ ...form, maxStay: e.target.value });
            rerender();
          }}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <input
            type="checkbox"
            checked={form.closedToArrival}
            onChange={(e) => {
              setForm({ ...form, closedToArrival: e.target.checked });
              rerender();
            }}
          />
          Closed to arrival
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={form.closedToDeparture}
            onChange={(e) => {
              setForm({ ...form, closedToDeparture: e.target.checked });
              rerender();
            }}
          />
          Closed to departure
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={form.stopSell}
            onChange={(e) => {
              setForm({ ...form, stopSell: e.target.checked });
              rerender();
            }}
          />
          Stop sell
        </label>
      </>
    ),
    foot: (
      <>
        <button type="button" className="button button--ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="button button--primary" disabled={submitting} onClick={submit}>
          {submitting ? "Pushing…" : "Push"}
        </button>
      </>
    ),
  };
}
