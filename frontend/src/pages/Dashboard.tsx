import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MockDataNotice } from "../components/MockDataNotice";
import { PageHeader } from "../components/PageHeader";
import { Pill } from "../components/Pill";
import { channexProperties, channexRatePlans, channexRoomTypes, otaChannels } from "../mockData/channexMiddleware";
import { CX, EQ, counters } from "../mockData/core";
import { errorQueueRows } from "../mockData/monitoring";
import { fmt } from "../lib/format";

const onboardedCount = channexProperties.filter((p) => p.onboarded).length;
const openErrors = errorQueueRows.filter((e) => e.status === "Pending").length;
const activeChannels = otaChannels.filter((c) => c.status === "Active").length;
const roomTypesMapped = channexRoomTypes.filter((r) => r.mapped).length;
const ratePlansMapped = channexRatePlans.filter((r) => r.mapped).length;

export function Dashboard() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live view of the EQ → Gateway Quest → Channex pipeline"
      />
      <MockDataNotice />

      <div className="pipeline-strip">
        <div className="card pipeline-strip__stage">
          <div className="pipeline-strip__stage-label">Source</div>
          <div className="pipeline-strip__stage-name">{EQ.name}</div>
          <div className="muted">{EQ.mode} · {EQ.lastMessage}</div>
        </div>
        <div className="card pipeline-strip__stage">
          <div className="pipeline-strip__stage-label">Pass-through</div>
          <div className="pipeline-strip__stage-name">Gateway Quest</div>
          <div className="muted">{openErrors} row(s) held for integration fixes</div>
        </div>
        <div className="card pipeline-strip__stage">
          <div className="pipeline-strip__stage-label">Middleware</div>
          <div className="pipeline-strip__stage-name">Channex</div>
          <div className="muted">{CX.status} · {CX.latency}ms</div>
        </div>
        <div className="card pipeline-strip__stage">
          <div className="pipeline-strip__stage-label">Demand</div>
          <div className="pipeline-strip__stage-name">OTA Channels</div>
          <div className="muted">{activeChannels} active OTA channels</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="card stat-tile">
          <div className="stat-tile__label">Properties onboarded</div>
          <div className="stat-tile__value">{onboardedCount} / {channexProperties.length}</div>
        </div>
        <div className="card stat-tile">
          <div className="stat-tile__label">Pushes today</div>
          <div className="stat-tile__value">{fmt(counters.pushesToday)}</div>
        </div>
        <div className="card stat-tile">
          <div className="stat-tile__label">Bookings today</div>
          <div className="stat-tile__value">{fmt(counters.bookingsToday)}</div>
        </div>
        <div className="card stat-tile">
          <div className="stat-tile__label">Open error queue items</div>
          <div className="stat-tile__value">{openErrors}</div>
        </div>
      </div>

      <h2 className="section-title">Channex data</h2>
      <div className="stat-grid">
        <div className="card stat-tile">
          <div className="stat-tile__label">Properties onboarded to Channex</div>
          <div className="stat-tile__value">{onboardedCount} / {channexProperties.length}</div>
          <div className="stat-tile__hint"><Link to="/channex/properties">View properties →</Link></div>
        </div>
        <div className="card stat-tile">
          <div className="stat-tile__label">Room types mapped</div>
          <div className="stat-tile__value">{roomTypesMapped} / {channexRoomTypes.length}</div>
          <div className="stat-tile__hint"><Link to="/channex/room-types">View room types →</Link></div>
        </div>
        <div className="card stat-tile">
          <div className="stat-tile__label">Rate plans mapped</div>
          <div className="stat-tile__value">{ratePlansMapped} / {channexRatePlans.length}</div>
          <div className="stat-tile__hint"><Link to="/channex/rate-plans">View rate plans →</Link></div>
        </div>
        <div className="card stat-tile">
          <div className="stat-tile__label">OTA channels active</div>
          <div className="stat-tile__value">{activeChannels} / {otaChannels.length}</div>
          <div className="stat-tile__hint"><Link to="/channex/ota-channels">View channels →</Link></div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">
          <Icon name="activity" /> Connection status
        </h2>
        <dl className="property-detail-list">
          <div className="property-detail-list__row">
            <dt>Enterprise Quest</dt>
            <dd><Pill label={EQ.status} tone="success" /></dd>
          </div>
          <div className="property-detail-list__row">
            <dt>Channex</dt>
            <dd><Pill label={CX.status} tone="success" /></dd>
          </div>
          <div className="property-detail-list__row">
            <dt>Rate limit used</dt>
            <dd>{CX.rateLimit.used} of {CX.rateLimit.limit} ({CX.rateLimit.window})</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
