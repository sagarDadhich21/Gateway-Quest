import { NextFunction, Request, Response } from "express";
import { adminOnlyError } from "../errors/AppError";

/**
 * Must run after `authenticate` - gates a route to callers whose GQ token carries BQ's
 * "Super_Admin" role. `roles` is passed straight through from BQ's own login response
 * (see auth.service.ts) - "Super_Admin" is the real role name BQ itself checks for
 * top-level admin access (bq/backend/.../contract.py: `role_name == "Super_Admin"`),
 * not a GQ-invented one.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.roles.includes("Super_Admin")) {
    next(adminOnlyError());
    return;
  }
  next();
}
