import type { Request, Response, NextFunction } from "express";
function genId() { return "req_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const hdr = (req.headers["x-request-id"] as string) || "";
  const id = hdr && typeof hdr === "string" ? hdr : genId();
  (req as any).reqId = id;
  res.setHeader("x-request-id", id);
  next();
}