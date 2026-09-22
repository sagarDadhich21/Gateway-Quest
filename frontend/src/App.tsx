import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import { AppLayout } from "./layout/AppLayout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { PropertyPage } from "./pages/PropertyPage";
import { Settings } from "./pages/Settings";
import { InventoryCalendar } from "./pages/eq/InventoryCalendar";
import { InboundAriFeed } from "./pages/eq/InboundAriFeed";
import { FieldOwnership } from "./pages/eq/FieldOwnership";
import { InboundAriStatus } from "./pages/ariStatus/InboundAriStatus";
import { Connection } from "./pages/channex/Connection";
import { ChannexProperties } from "./pages/channex/Properties";
import { ChannexRoomTypes } from "./pages/channex/RoomTypes";
import { ChannexRatePlans } from "./pages/channex/RatePlans";
import { OtaChannels } from "./pages/channex/OtaChannels";
import { RoomTypeMapping } from "./pages/mapping/RoomTypeMapping";
import { RatePlanMapping } from "./pages/mapping/RatePlanMapping";
import { AvailabilityPush } from "./pages/distribution/AvailabilityPush";
import { RatesPush } from "./pages/distribution/RatesPush";
import { Restrictions } from "./pages/distribution/Restrictions";
import { BookingRevisions } from "./pages/bookings/BookingRevisions";
import { ChannexTasks } from "./pages/monitoring/ChannexTasks";
import { ApiLogs } from "./pages/monitoring/ApiLogs";
import { WebhookLog } from "./pages/monitoring/WebhookLog";
import { ErrorQueue } from "./pages/monitoring/ErrorQueue";
import { Reports } from "./pages/reports/Reports";
import { AdminUsers } from "./pages/admin/Users";
import { AdminRoles } from "./pages/admin/Roles";
import { AuditLog } from "./pages/admin/AuditLog";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RequireAuth />}>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/my-property" element={<PropertyPage />} />

        <Route path="/eq/inventory-calendar" element={<InventoryCalendar />} />
        <Route path="/eq/inbound-ari-feed" element={<InboundAriFeed />} />
        <Route path="/eq/field-ownership" element={<FieldOwnership />} />

        <Route path="/ari-status" element={<InboundAriStatus />} />

        <Route path="/channex/connection" element={<Connection />} />
        <Route path="/channex/properties" element={<ChannexProperties />} />
        <Route path="/channex/room-types" element={<ChannexRoomTypes />} />
        <Route path="/channex/rate-plans" element={<ChannexRatePlans />} />
        <Route path="/channex/ota-channels" element={<OtaChannels />} />

        <Route path="/mapping/room-types" element={<RoomTypeMapping />} />
        <Route path="/mapping/rate-plans" element={<RatePlanMapping />} />

        <Route path="/distribution/availability" element={<AvailabilityPush />} />
        <Route path="/distribution/rates" element={<RatesPush />} />
        <Route path="/distribution/restrictions" element={<Restrictions />} />

        <Route path="/bookings/revisions" element={<BookingRevisions />} />

        <Route path="/monitoring/tasks" element={<ChannexTasks />} />
        <Route path="/monitoring/api-logs" element={<ApiLogs />} />
        <Route path="/monitoring/webhook-log" element={<WebhookLog />} />
        <Route path="/monitoring/error-queue" element={<ErrorQueue />} />

        <Route path="/reports" element={<Reports />} />

        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/roles" element={<AdminRoles />} />
        <Route path="/admin/audit-log" element={<AuditLog />} />

        <Route path="/settings" element={<Settings />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
