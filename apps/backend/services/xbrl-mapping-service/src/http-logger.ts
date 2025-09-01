import type { Request, Response, NextFunction } from "express";
import { log } from "./logger";
export function httpLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const id = (req as any).reqId || "";
  res.on("finish", () => {
    log.info("http", {
      reqId: id,
      method: req.method,
      path: (req as any).originalUrl || req.url,
      status: res.statusCode,
      ms: Date.now() - start
    });
  });
  next();
}