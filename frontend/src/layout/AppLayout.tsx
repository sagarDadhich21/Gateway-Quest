import { Outlet } from "react-router-dom";
import { HelpButton } from "./HelpButton";
import { Sidebar } from "./Sidebar";
import { UserMenu } from "./UserMenu";

export function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <header className="app-shell__topbar">
          <span className="muted small">Preview build — sample data unless noted</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <HelpButton />
            <UserMenu />
          </div>
        </header>
        <div className="app-shell__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
