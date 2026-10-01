import { useState } from "react";
import { Outlet } from "react-router-dom";
import { HelpButton } from "./HelpButton";
import { Sidebar } from "./Sidebar";
import { UserMenu } from "./UserMenu";

const SIDEBAR_COLLAPSED_KEY = "gq_sidebar_collapsed";

function readStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // per-viewer convenience only - fine if it doesn't persist
      }
      return next;
    });
  }

  return (
    <div className={"app-shell" + (collapsed ? " app-shell--collapsed" : "")}>
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <div className="app-shell__main">
        <header className="app-shell__topbar">
          <span className="muted small"></span>
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
