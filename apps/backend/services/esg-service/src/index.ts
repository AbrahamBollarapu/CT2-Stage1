import { registerOpenApi } from './openapi';
import { httpLogger } from './http-logger';
import { requestIdMiddleware } from './request-id';
import { registerReady } from './ready';
        import express from "express";

        const app = express();
app.use(requestIdMiddleware);
app.use(httpLogger);
registerOpenApi(app);
registerReady(app);
        app.use(express.json());

        const PORT = Number(process.env.PORT || 8000);
        const SERVICE = process.env.SERVICE_NAME || "service";

        app.get("/health", (_req, res) => {
          res.json({ status: "ok", service: SERVICE, port: PORT });
        });

        // Demo ESG metrics (static for Stage-1)
app.get("/metrics", (req, res) => {
  const period = String(req.query.period || "2024Q4");
  const account = String(req.query.account || "demo");
  res.json({
    ok: true,
    period, account,
    metrics: {
      "energy.kwh": 125000,
      "scope2.co2e": 102500,
      "facility.area_m2": 50000,
      "revenue_inr": 25000000
    }
  });
});

        app.listen(PORT, "0.0.0.0", () => {
          console.log(`[${SERVICE}] listening on ${PORT}`);
        });

// ==== CT2_PATCH:ESG_COMPUTE (auto-added) ====
/** CT2_PATCH:ESG_COMPUTE */
app.post("/compute", (req: any, res: any) => {
  try {
    const account = String((req.body?.account) ?? req.query.account ?? "");
    const period  = String((req.body?.period)  ?? req.query.period  ?? "");
    if (!account || !period) return res.status(400).json({ ok:false, error:"account and period are required" });
    // TODO hook real compute; demo ack for E2E flow
    res.json({ ok:true, account, period, computed:true });
  } catch (e:any) { res.status(500).json({ ok:false, error:String(e?.message||e) }); }
});


app.get('/ready', (_req, res) => res.json({ ok: true }));
