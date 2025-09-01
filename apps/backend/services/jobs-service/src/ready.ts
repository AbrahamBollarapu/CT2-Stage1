import { Express, Request, Response } from "express";
export function registerReady(app: Express) {
  app.get("/ready", async (_req: Request, res: Response) => {
    // TODO: add real dependency checks here (DB ping, queue, downstream svc)
    res.status(200).json({ ok: true });
  });
}