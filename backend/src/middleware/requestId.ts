import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

const HEADER = "x-request-id";

/**
 * Attaches a correlation id to every request - reused from the inbound header when the
 * caller already provides one (so a request can be traced across GQ -> BQ -> Channex),
 * otherwise generated fresh. Echoed back on the response so callers can log it too.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  req.correlationId = incoming && incoming.trim().length > 0 ? incoming : randomUUID();
  res.setHeader(HEADER, req.correlationId);
  next();
}
