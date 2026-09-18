import { NavLink } from "react-router-dom";
import { Icon } from "../components/Icon";
import { NAV_GROUPS } from "./navConfig";

export function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Primary">
      <div className="sidebar__brand">
        <div className="sidebar__brand-text">
          <span className="t1">Gateway Quest</span>
          <span className="t2">CHANNEX DISTRIBUTION</span>
        </div>
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
