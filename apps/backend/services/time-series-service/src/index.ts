import { registerSeed } from './seed-demo';
import express from "express";
import { requestIdMiddleware } from "./request-id";
import { httpLogger } from "./http-logger";
import { registerOpenApi } from "./openapi";

// App
const app = express();
app.use(express.json());
/* C4:TS-SEED */
registerSeed(app);

// Middlewares (order matters)
app.use(requestIdMiddleware);
app.use(httpLogger);

// Health + Ready
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/ready",  (_req, res) => res.json({ ok: true }));

// OpenAPI stub
registerOpenApi(app, "time-series-service");

// Boot
const port = Number(process.env.PORT || 8000);
app.listen(port, () => {
  console.log(`[time-series-service] listening on ${port}`);
});

export default app;