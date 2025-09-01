import express from "express";

const app = express();
const PORT = process.env.PORT || 8000;
const PREFIX = "/api/factors";

app.use(express.json({ limit: "5mb" }));
app.get(PREFIX + "/health", (_req, res) => res.json({ ok: true, service: "emission-factors-service" }));

// demo in-memory factors
let FACTORS = []; // [{activity, unit, factor, scope?}]

app.post(PREFIX + "/seed", (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "expected JSON array" });
  FACTORS = req.body.map(f => ({
    activity: String(f.activity || ""),
    unit: String(f.unit || ""),
    factor: Number(f.factor ?? 0),
    scope: f.scope || null,
  }));
  res.json({ ok: true, count: FACTORS.length });
});

app.get(PREFIX + "/all", (_req, res) => res.json(FACTORS));

app.listen(PORT, "0.0.0.0", () =>
  console.log(`[emission-factors-service] listening on 0.0.0.0:${PORT} (prefix=${PREFIX})`)
);
