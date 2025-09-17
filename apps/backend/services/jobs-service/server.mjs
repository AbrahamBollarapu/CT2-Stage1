import express from "express";
import fetch from "node-fetch";
const app = express(); app.use(express.json());
const BASE = process.env.GATEWAY_BASE || "http://localhost:8081";
const ORG  = process.env.DEMO_ORG || "demo";
const PERIOD = process.env.FALLBACK_PERIOD || "2024Q4";
const h = { "x-api-key": "ct2-dev-key", "Content-Type": "application/json" };

app.get("/health", async (_, res) => {
  try {
    const r1 = await fetch(`${BASE}/api/esg/health`).catch(()=>({ok:false}));
    const r2 = await fetch(`${BASE}/api/data-quality/health`).catch(()=>({ok:false}));
    return res.json({ ok: true, deps: { esg: !!r1?.ok, dq: !!r2?.ok } });
  } catch { return res.json({ ok: true }); }
});

// add alongside the existing /health (leave the old one too)
app.get("/api/jobs/health", async (_, res) => {
  res.json({ ok: true });
});

app.post("/api/jobs/run/demo", async (req, res) => {
  try {
    await fetch(`${BASE}/api/time-series/points`, { method:"POST", headers:h,
      body: JSON.stringify({ org_id: ORG, meter:"grid_kwh", unit:"kWh", points:[{ ts:"2024-11-05T00:00:00Z", value:118.0 }] }) });
    await fetch(`${BASE}/api/esg/compute`, { method:"POST", headers:h, body: JSON.stringify({ account: ORG, period: PERIOD }) });
    await fetch(`${BASE}/api/data-quality/evaluate`, { method:"POST", headers:h, body: JSON.stringify({ account: ORG, period: PERIOD }) });

    const build = await fetch(`${BASE}/api/reports/build`, { method:"POST", headers:h, body: JSON.stringify({ template:"truststrip", period: PERIOD }) }).then(r=>r.json());
    const id = build.artifactId; let status = "queued", tries = 0;
    while (status !== "completed" && tries < 20) {
      await new Promise(r=>setTimeout(r, 600));
      status = await fetch(`${BASE}/api/reports/status/${id}`).then(r=>r.json()).then(j=>j.status);
      tries++;
    }
    return res.json({ ok: status==="completed", artifactId: id, status });
  } catch (e) { return res.status(500).json({ ok:false, error: String(e) }); }
});

const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`jobs-service listening on :${port}`));
