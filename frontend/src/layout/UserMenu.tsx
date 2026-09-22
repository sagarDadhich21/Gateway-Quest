import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useToast } from "../components/toast/ToastContext";
import { clearSession, getSession } from "../auth/session";

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const navigate = useNavigate();

  const session = getSession();
  const email = session?.email ?? "unknown@quest.io";
  const displayName = email.split("@")[0];

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
    clearSession();
    toast("Logged out", "ok");
    navigate("/login", { replace: true });
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu__avatar"
        title={displayName}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {displayName.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div className="user-menu__panel" role="menu">
          <div className="user-menu__header">
            <div className="user-menu__name">{displayName}</div>
            <div className="user-menu__email">{email}</div>
          </div>
          <button type="button" className="user-menu__logout" role="menuitem" onClick={logout}>
            <Icon name="log-out" size="sm" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
