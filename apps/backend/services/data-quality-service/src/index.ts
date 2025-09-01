import { registerOpenApi } from './openapi';
import { httpLogger } from './http-logger';
import { requestIdMiddleware } from './request-id';
import { registerReady } from './ready';
import express from "express";
const app = express(); app.use(express.json());
app.use(requestIdMiddleware);
app.use(httpLogger);
registerOpenApi(app);
registerReady(app);
const PORT = Number(process.env.PORT || 8000);
app.get("/health", (_req, res) => res.json({ status: "ok", service: "data-quality-service", port: PORT }));

type Rule = { metric: string; rule: string };
let rules: Rule[] = [];
app.post("/rules", (req, res) => {
  rules = Array.isArray(req.body) ? req.body : [];
  res.json({ ok: true, count: rules.length });
});
app.get("/heatmap", (req, res) => {
  const period = String(req.query.period ?? "2024Q4");
  const account = String(req.query.account ?? "demo");
  const metrics = (rules.length ? rules.map(r => r.metric) : ["scope2.co2e", "energy.kwh"]);
  const grid = metrics.map(m => ({ metric: m, period, account, ok: true }));
  res.json({ ok: true, period, account, grid });
});

app.listen(PORT, "0.0.0.0", () => console.log(`[data-quality-service] ${PORT}`));

// ==== CT2_PATCH:DQ_EVALUATE (auto-added) ====
/** CT2_PATCH:DQ_EVALUATE */
app.post("/evaluate", (req: any, res: any) => {
  try {
    const account = String((req.body?.account) ?? req.query.account ?? "");
    const period  = String((req.body?.period)  ?? req.query.period  ?? "");
    if (!account || !period) return res.status(400).json({ ok:false, error:"account and period are required" });
    // TODO hook real evaluation; demo ack
    res.json({ ok:true, evaluated:true, account, period });
  } catch (e:any) { res.status(500).json({ ok:false, error:String(e?.message||e) }); }
});


app.get('/ready', (_req, res) => res.json({ ok: true }));
