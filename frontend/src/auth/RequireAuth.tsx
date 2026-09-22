import { Navigate, Outlet } from "react-router-dom";
import { getToken } from "./session";

/** Gates every route nested under it behind a real GQ session token - no token means straight to /login, not a broken authenticated page. */
export function RequireAuth() {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
