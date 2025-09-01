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
app.get("/health", (_req, res) => res.json({ status: "ok", service: "dashboards-service", port: PORT }));

let features = { alerts:{enabled:false}, payments:{enabled:false}, blockchain:{anchor:false}, copilot:{enabled:false} } as any;
try { if (process.env.FEATURES_JSON) features = JSON.parse(process.env.FEATURES_JSON); } catch {}

app.get("/landing", (_req, res) => {
  res.json({
    ok: true,
    tiles: {
      search: true, statusGrid: true, trustStrip: true, buildReport: true,
      placeholders: {
        suppliers: true, materiality: true, risk: true, alerts: !features.alerts?.enabled,
        governance: true, marketplace: true, payments: !features.payments?.enabled,
        verificationBlockchain: !features.blockchain?.anchor, scheduler: true,
        procurementConnectors: true, copilot: !features.copilot?.enabled
      }
    }
  });
});

app.listen(PORT, "0.0.0.0", () => console.log(`[dashboards-service] ${PORT}`));
