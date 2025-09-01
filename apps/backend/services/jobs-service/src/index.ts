import { registerOpenApi } from './openapi';
import { httpLogger } from './http-logger';
import { requestIdMiddleware } from './request-id';
import { registerJobsApi } from './jobs-api';
import { registerReady } from './ready';
import express from "express";
const app = express(); app.use(express.json());
app.use(requestIdMiddleware);
app.use(httpLogger);
registerOpenApi(app);
registerJobsApi(app);
registerReady(app);
const PORT = Number(process.env.PORT || 8000);
app.get("/health", (_req, res) => res.json({ status: "ok", service: "jobs-service", port: PORT }));
app.get("/status/:id", (req, res) => res.json({ ok: true, id: req.params.id, state: "ready" }));
app.listen(PORT, "0.0.0.0", () => console.log(`[jobs-service] ${PORT}`));


