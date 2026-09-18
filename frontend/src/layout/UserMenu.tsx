import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { useToast } from "../components/toast/ToastContext";

const CURRENT_USER = { name: "Gateway Admin", email: "admin@rhombusquest.com" };

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function logout() {
    setOpen(false);
    toast("Logged out", "ok");
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu__avatar"
        title={CURRENT_USER.name}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {CURRENT_USER.name.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div className="user-menu__panel" role="menu">
          <div className="user-menu__header">
            <div className="user-menu__name">{CURRENT_USER.name}</div>
            <div className="user-menu__email">{CURRENT_USER.email}</div>
          </div>
          <button type="button" className="user-menu__logout" role="menuitem" onClick={logout}>
            <Icon name="log-out" size="sm" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
