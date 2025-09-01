import express from "express";            // instead of: import express from 'express' (ok but ensure esModuleInterop true)
export default function mount(app: express.Express) {
  const r = express.Router();
  r.get("/health", (_req, res) => res.json({ ok: true, service: process.env.SERVICE_NAME || "svc" }));
  // TODO: move routes from old server.mjs here
  app.use(process.env.SERVICE_PREFIX || "/api/unknown", r);
}
