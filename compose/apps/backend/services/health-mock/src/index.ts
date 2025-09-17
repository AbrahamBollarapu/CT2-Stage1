import express from "express";
const app = express();
app.use(express.json());

const services = ["esg","data-quality","kpi","jobs","dash","xbrl"] as const;
for (const s of services) {
  app.get(`/api/${s}/health`, (_req, res) => res.json({ ok: true, service: s }));
  app.get(`/api/${s}/ready`,  (_req, res) => res.json({ ok: true, service: s }));
}

// generic (local checks)
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/ready",  (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 8000);
app.listen(PORT, () => console.log("[health-mock] listening on", PORT));
export default app;
