import { useEffect, useState } from "react";
import { useCurrentPropertyId } from "../../auth/useCurrentProperty";
import { extractErrorMessage } from "../../api/client";
import { getBooking, listBookings } from "../../api/gqApi";
import { OtaBookingResponse, OtaBookingStatus } from "../../api/types";
import { DataTable, DataTableColumn } from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { Pill } from "../../components/Pill";
import { useModal } from "../../components/modal/ModalContext";
import { useToast } from "../../components/toast/ToastContext";
import { money, stayRange } from "../../lib/format";
import { formatDateTime, RevisionIssueCell, RevisionStatusCell, STATUS_TONE } from "./revisionCells";

/**
 * GQ's own ingestion state (gq_ota_booking), not a live Channex read - one row per
 * distinct Channex booking_id, created/updated by processRevision() (webhook + the
 * ~15-minute recovery feed), never by a direct write from this UI. See the "View" modal
 * for the full revision history behind each booking.
 */
export function Bookings() {
  const propertyId = useCurrentPropertyId();
  const [rows, setRows] = useState<OtaBookingResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState<OtaBookingStatus | "all">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showModal, closeModal } = useModal();
  const toast = useToast();

  async function load() {
    if (propertyId === null) return;
    setLoading(true);
    setError(null);
    try {
      const bookings = await listBookings(propertyId, statusFilter === "all" ? undefined : statusFilter);
      setRows(bookings);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, statusFilter]);

  async function openDetail(booking: OtaBookingResponse) {
    showModal({
      title: booking.uniqueId,
      wide: true,
      body: <p className="muted small">Loading…</p>,
    });
    try {
      const detail = await getBooking(propertyId!, booking.id);
      showModal({
        title: detail.uniqueId,
        wide: true,
        body: (
          <>
            <dl className="property-detail-list">
              <div className="property-detail-list__row">
                <dt>Status</dt>
                <dd><Pill label={detail.status} tone={STATUS_TONE[detail.status]} /></dd>
              </div>
              <div className="property-detail-list__row">
                <dt>Channex booking id</dt>
                <dd className="mono small">{detail.cxBookingId}</dd>
              </div>
              <div className="property-detail-list__row">
                <dt>BQ order / booking</dt>
                <dd className="mono small">{detail.bqOrderId ?? "—"} / {detail.bqBookingId ?? "—"}</dd>
              </div>
              <div className="property-detail-list__row">
                <dt>Currency</dt>
                <dd>{detail.currency}</dd>
              </div>
              <div className="property-detail-list__row">
                <dt>Created</dt>
                <dd>{formatDateTime(detail.createdAt)}</dd>
              </div>
            </dl>
            <h4 style={{ marginBottom: 8 }}>Revision history</h4>
            {detail.revisions.length === 0 ? (
              <p className="muted small">No revisions recorded.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Stay</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th>Received</th>
                    <th>Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.revisions.map((r) => (
                    <tr key={r.id}>
                      <td><RevisionStatusCell revision={r} /></td>
                      <td className="small">{stayRange(r.arrivalDate, r.departureDate)}</td>
                      <td style={{ textAlign: "right" }}>{money(r.amountMinorUnits, r.currency)}</td>
                      <td className="small">{formatDateTime(r.receivedAt)}</td>
                      <td><RevisionIssueCell revision={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ),
        foot: (
          <button type="button" className="button button--ghost" onClick={closeModal}>
            Close
          </button>
        ),
      });
    } catch (err) {
      toast(extractErrorMessage(err), "err");
      closeModal();
    }
  }

  const columns: DataTableColumn<OtaBookingResponse>[] = [
    {
      key: "booking",
      label: "OTA booking",
      render: (b) => (
        <>
          <strong>{b.uniqueId}</strong>
          <div className="muted small mono">{b.cxBookingId}</div>
        </>
      ),
    },
    { key: "status", label: "Status", render: (b) => <Pill label={b.status} tone={STATUS_TONE[b.status]} /> },
    {
      key: "bq",
      label: "BQ booking",
      render: (b) => (b.bqBookingId ? <span className="mono small">{b.bqBookingId}</span> : <span className="muted small">Not yet created</span>),
    },
    { key: "currency", label: "Currency", render: (b) => b.currency },
    { key: "updated", label: "Last updated", render: (b) => formatDateTime(b.updatedAt) },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (b) => (
        <button type="button" className="button button--ghost" onClick={() => void openDetail(b)}>
          View
        </button>
      ),
    },
  ];

  if (propertyId === null) {
    return (
      <div>
        <PageHeader title="Bookings" description="OTA bookings ingested from Channex into BQ" />
        <div className="card">
          <p className="muted">Your account has no assigned property, so there is nothing to load here.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Bookings" description="OTA bookings ingested from Channex into BQ" />
      {error && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="form-error" role="alert">{error}</p>
        </div>
      )}
      <div className="card" style={{ marginBottom: 20 }}>
        <label className="field" style={{ maxWidth: 240 }}>
          <span className="field__label">Status</span>
          <select
            className="field__input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OtaBookingStatus | "all")}
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="modified">Modified</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>
      <div className="card">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(b) => b.id}
          emptyMessage={loading ? "Loading…" : "No OTA bookings yet."}
        />
      </div>
    </div>
  );
}
