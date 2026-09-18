import { Icon } from "../components/Icon";
import { useModal } from "../components/modal/ModalContext";
import { CX } from "../mockData/core";

/** Content ported verbatim from openHelp() in the source (lines 944-965). */
export function HelpButton() {
  const { showModal } = useModal();

  function openHelp() {
    showModal({
      title: "How this pipeline works",
      wide: true,
      body: (
        <>
          <div className="section-title">Data flow</div>
          <p className="small" style={{ lineHeight: 1.7 }}>
            1. <strong>Enterprise Quest (EQ)</strong> owns and decides every rate, availability and restriction value, and
            pushes it here.
            <br />
            2. <strong>Gateway Quest</strong> never edits, overrides or rejects that data — it makes it visible and
            forwards it. A row is only held back when Channex would technically reject it (missing mapping, missing
            onboarding, an invalid value), and it resumes on its own once fixed.
            <br />
            3. <strong>Channex</strong> is the only middleware. Forwarded values are batched into{" "}
            <span className="mono">POST /availability</span> (room-type level) and{" "}
            <span className="mono">POST /restrictions</span> (rate-plan level).
            <br />
            4. <strong>OTAs</strong> (Booking.com, Expedia, Airbnb, Agoda, Hostelworld, Trip.com) receive the data from
            Channex — Gateway Quest never talks to an OTA directly.
            <br />
            5. Bookings return through the <strong>Channex booking revisions feed</strong>, and are acknowledged only
            once EQ has stored them.
          </p>
          <div className="section-title">Channex rules this UI enforces</div>
          <ul className="small" style={{ lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
            <li>
              Availability is pushed per <span className="mono">room_type_id</span>; rates and restrictions per{" "}
              <span className="mono">rate_plan_id</span>, batched per property.
            </li>
            <li>Availability and rate/restriction changes are sent as <strong>separate batched messages</strong>.</li>
            <li>Rate must be greater than zero; min stay must be at least 1; a rate plan cannot exceed its room type&apos;s occupancy.</li>
            <li>
              A <span className="mono">200 OK</span> can still contain per-row warnings — those rows are rejected and
              land in the Error Queue.
            </li>
            <li>Rate and availability limits are roughly 10 requests per minute, per property, and each message must stay under {CX.maxMessageMb}MB.</li>
            <li>Rate limiting returns <span className="mono">429</span>; webhook retries back off over 11 attempts, up to roughly 24 hours.</li>
          </ul>
        </>
      ),
    });
  }

  return (
    <button type="button" className="icon-btn" title="Help" onClick={openHelp}>
      <Icon name="help" />
    </button>
  );
}
