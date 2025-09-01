import type { Express, Request, Response } from "express";

export function registerRoutes(app: Express) {
  // POST /recompute  { account, period }
  app.post("/recompute", (req: Request, res: Response) => {
    const { account, period } = (req.body || {}) as { account?: string; period?: string };
    // Stage-1 stub: acknowledge recompute
    return res.json({ ok: true, account, period, recomputed: true });
  });

  // GET /list?account=...&period=...
  app.get("/list", (req: Request, res: Response) => {
    const { account, period } = req.query as { account?: string; period?: string };
    // Stage-1 stub payload (enough for smoke tests)
    return res.json({
      ok: true,
      account,
      period,
      kpis: [
        { key: "demo.kpi.sample", value: 42, unit: "pts" }
      ]
    });
  });
}