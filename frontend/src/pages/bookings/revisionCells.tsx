import { OtaBookingAckStatus, OtaBookingRevisionResponse, OtaBookingStatus } from "../../api/types";
import { Pill, PillTone } from "../../components/Pill";

export const STATUS_TONE: Record<OtaBookingStatus, PillTone> = {
  new: "success",
  modified: "info",
  cancelled: "neutral",
};

export const ACK_TONE: Record<OtaBookingAckStatus, PillTone> = {
  acked: "success",
  pending: "warning",
};

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Revision status + ack status together, stacked - one column instead of two. */
export function RevisionStatusCell({ revision }: { revision: OtaBookingRevisionResponse }) {
  return (
    <div className="revision-status-cell">
      <Pill label={revision.status} tone={STATUS_TONE[revision.status]} />
      <Pill label={revision.ackStatus} tone={ACK_TONE[revision.ackStatus]} />
    </div>
  );
}

/**
 * Blocking reason + attempt count, combined into one bounded/truncated column instead
 * of two unbounded ones - a raw JSON-ish reason string was stretching the whole table
 * wide. Full text is still available via the native title tooltip on hover.
 */
export function RevisionIssueCell({ revision }: { revision: OtaBookingRevisionResponse }) {
  if (!revision.blockingReason) {
    return <span className="muted small">—</span>;
  }
  return (
    <div className="revision-issue-cell" title={revision.blockingReason}>
      <span className="revision-issue-cell__reason">{revision.blockingReason}</span>
      {revision.processingAttempts > 0 && (
        <span className="revision-issue-cell__attempts">
          Attempt {revision.processingAttempts}
        </span>
      )}
    </div>
  );
}
