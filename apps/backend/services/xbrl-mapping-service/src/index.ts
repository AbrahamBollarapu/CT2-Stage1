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

// direct container health (still available at :8059/health)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "xbrl-mapping-service", port: PORT });
});

// mount all API routes under /api/xbrl so Traefik prefix is naturally handled
const api = express.Router();

api.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "xbrl-mapping-service", port: PORT, via: "/api/xbrl" });
});

api.get("/coverage", (req, res) => {
  const period = String(req.query.period || "2024Q4");
  const account = String(req.query.account || "demo");
  res.json({ ok: true, period, account, coverage: 5, of: 5 });
});

api.get("/validation-log", (req, res) => {
  const artifactId = String(req.query.artifactId || "");
  res.json({ ok: true, artifactId, errors: [] });
});

app.use("/api/xbrl", api);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[xbrl-mapping-service] listening on ${PORT}`);
});
