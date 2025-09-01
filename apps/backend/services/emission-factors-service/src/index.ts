import { registerSeed } from './seed-demo';
import { registerOpenApi } from './openapi';
import { httpLogger } from './http-logger';
import { requestIdMiddleware } from './request-id';
import { registerReady } from './ready';
import express from "express";
const app = express(); app.use(express.json());
app.use(requestIdMiddleware);
/* C4:EMF-SEED */
registerSeed(app);
app.use(httpLogger);
registerOpenApi(app);
registerReady(app);
const PORT = Number(process.env.PORT || 8000);
app.get("/health", (_req, res) => res.json({ status: "ok", service: "emission-factors-service", port: PORT }));

type Factor = { value: number; unit: string };
const factors: Record<string, Factor> = {};
app.post("/seed", (req, res) => {
  if (Array.isArray(req.body)) {
    for (const f of req.body) {
      if (f?.key) factors[String(f.key)] = { value: Number(f.value), unit: String(f.unit ?? "") };
    }
  }
  res.json({ ok: true, count: Object.keys(factors).length });
});
app.get("/factor", (req, res) => {
  const key = String(req.query.key ?? "");
  const f = factors[key];
  res.json({ ok: !!f, key, ...(f ?? {}) });
});

app.listen(PORT, "0.0.0.0", () => console.log(`[emission-factors-service] ${PORT}`));
