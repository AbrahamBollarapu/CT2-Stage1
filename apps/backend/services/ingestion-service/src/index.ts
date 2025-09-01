import express from "express";
import { requestIdMiddleware } from "./request-id";
import { httpLogger } from "./http-logger";
import { registerOpenApi } from "./openapi";

const app = express();
app.use(express.json());

// middlewares (order matters)
app.use(requestIdMiddleware);
app.use(httpLogger);

// opportunistically mount any existing routes without breaking compile
try {
  // @ts-ignore
  const mod = require("./routes");
  if (mod?.registerRoutes) { mod.registerRoutes(app); }
  else if (mod?.router)    { app.use(mod.router); }
} catch (_) {}

try {
  // @ts-ignore
  const api = require("./api");
  if (typeof api === "function") { app.use(api); }
  else if (api?.default && typeof api.default === "function") { app.use(api.default); }
  else if (api?.router) { app.use(api.router); }
} catch (_) {}

// health + ready
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/ready",  (_req, res) => res.json({ ok: true }));

registerOpenApi(app, "ingestion-service");

const port = Number(process.env.PORT || 8000);
app.listen(port, () => console.log("[ingestion-service] listening on", port));

export default app;