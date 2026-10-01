import { useEffect, useState } from "react";
import { useCurrentPropertyId } from "../../auth/useCurrentProperty";
import { extractErrorMessage } from "../../api/client";
import { listBookingRevisions } from "../../api/gqApi";
import { OtaBookingAckStatus, OtaBookingRevisionResponse } from "../../api/types";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { money, stayRange } from "../../lib/format";
import { formatDateTime, RevisionIssueCell, RevisionStatusCell } from "./revisionCells";

/**
 * Revisions across every OTA booking on the property (gq_ota_booking_revision) - each
 * revision is acknowledged back to Channex automatically as soon as it's durably
 * processed into BQ (see processRevision() in booking.service.ts), so there is no manual
 * "acknowledge" action here. What's useful to see here is which revisions are still
 * pending/blocked (processingAttempts, blockingReason) so a stuck one can be
 * investigated, rather than a queue to work through by hand.
 */
export function BookingRevisions() {
  const propertyId = useCurrentPropertyId();
  const [rows, setRows] = useState<OtaBookingRevisionResponse[]>([]);
  const [ackFilter, setAckFilter] = useState<OtaBookingAckStatus | "all">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (propertyId === null) return;
    setLoading(true);
    setError(null);
    try {
      const revisions = await listBookingRevisions(propertyId, ackFilter === "all" ? undefined : ackFilter);
      setRows(revisions);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, ackFilter]);

  const columns: DataTableColumn<OtaBookingRevisionResponse>[] = [
    { key: "guest", label: "Guest", render: (r) => r.guestName ?? <span className="muted">—</span> },
    { key: "status", label: "Status", render: (r) => <RevisionStatusCell revision={r} /> },
    { key: "stay", label: "Stay", render: (r) => stayRange(r.arrivalDate, r.departureDate) },
    { key: "amount", label: "Amount", align: "right", render: (r) => money(r.amountMinorUnits, r.currency) },
    { key: "received", label: "Received", render: (r) => formatDateTime(r.receivedAt) },
    { key: "issue", label: "Issue", render: (r) => <RevisionIssueCell revision={r} /> },
  ];

  if (propertyId === null) {
    return (
      <div>
        <PageHeader title="Booking Revisions" description="Channex revision feed for every OTA booking on this property" />
        <div className="card">
          <p className="muted">Your account has no assigned property, so there is nothing to load here.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Booking Revisions" description="Channex revision feed for every OTA booking on this property" />
      {error && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">{error}</p>
        </div>
      )}
      <div className="card" style={{ marginBottom: 20 }}>
        <label className="field" style={{ maxWidth: 240 }}>
          <span className="field__label">Ack status</span>
          <select
            className="field__input"
            value={ackFilter}
            onChange={(e) => setAckFilter(e.target.value as OtaBookingAckStatus | "all")}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="acked">Acked</option>
          </select>
        </label>
      </div>
      <div className="card">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          emptyMessage={loading ? "Loading…" : "No revisions received yet."}
        />
      </div>
    </div>
  );
}
