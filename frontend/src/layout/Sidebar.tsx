import { NavLink } from "react-router-dom";
import { Icon } from "../components/Icon";
import { NAV_GROUPS } from "./navConfig";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="Primary">
      <div className="sidebar__brand">
        <div className="sidebar__brand-text">
          <span className="t1">Gateway Quest</span>
        </div>
        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-left"} size="sm" />
        </button>
      </div>
      <div className="sidebar__scroll">
        {NAV_GROUPS.map((group, index) => (
          <div className="sidebar__group" key={group.title ?? `ungrouped-${index}`}>
            {group.title && <div className="sidebar__group-title">{group.title}</div>}
            <ul className="sidebar__list">
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      "sidebar__link" + (isActive ? " sidebar__link--active" : "")
                    }
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
