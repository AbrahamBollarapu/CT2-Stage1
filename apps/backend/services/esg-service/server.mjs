import express from "express";

const app = express();
const PORT = process.env.PORT || 8000;
const PREFIX = "/api/esg";

const TS_BASE = process.env.TS_BASE || "http://time-series-service:8000";
const FACT_BASE = process.env.FACT_BASE || "http://emission-factors-service:8000";

app.use(express.json({ limit: "5mb" }));
app.get(PREFIX + "/health", (_req, res) => res.json({ ok: true, service: "esg-service" }));

let METRICS_CACHE = { at: null, metrics: [] };

app.post(PREFIX + "/compute-demo", async (_req, res) => {
  try {
    const ptsResp = await fetch(`${TS_BASE}/api/timeseries/query?limit=10000`);
    if (!ptsResp.ok) throw new Error(`timeseries query ${ptsResp.status}`);
    const points = await ptsResp.json();

    const fResp = await fetch(`${FACT_BASE}/api/factors/all`);
    if (!fResp.ok) throw new Error(`factors all ${fResp.status}`);
    const factors = await fResp.json();

    const sum = arr => arr.reduce((a, b) => a + Number(b || 0), 0);
    const byMetric = m => points.filter(p => p.metric === m).map(p => Number(p.value || 0));

    const kwhTotal = sum(byMetric("grid_kwh"));
    const dieselLitres = sum(byMetric("diesel_l"));

    const kwhFactor   = (factors.find(f => f.activity === "electricity" && f.unit === "kWh") || {}).factor ?? 0;
    const dieselFactor= (factors.find(f => f.activity === "diesel" && f.unit === "litre") || {}).factor ?? 0;

    const scope2 = kwhTotal * kwhFactor;
    const scope1 = dieselLitres * dieselFactor;

    const metrics = [
      { metric: "electricity_kwh_total", value: kwhTotal, unit: "kWh" },
      { metric: "diesel_l_total",       value: dieselLitres, unit: "litre" },
      { metric: "scope2_co2e_demo",     value: scope2, unit: "co2e" },
      { metric: "scope1_co2e_demo",     value: scope1, unit: "co2e" },
    ];
    METRICS_CACHE = { at: new Date().toISOString(), metrics };

    // write derived points
    const write = [
      { metric: "scope2_co2e_demo", ts: new Date().toISOString(), value: scope2 },
      { metric: "scope1_co2e_demo", ts: new Date().toISOString(), value: scope1 },
    ];
    const w = await fetch(`${TS_BASE}/api/timeseries/points`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(write)
    });
    if (!w.ok) throw new Error(`timeseries write ${w.status}`);

    res.json({ ok: true, computedAt: METRICS_CACHE.at, metrics });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get(PREFIX + "/metrics", (_req, res) => res.json(METRICS_CACHE));

app.listen(PORT, "0.0.0.0", () =>
  console.log(`[esg-service] listening on 0.0.0.0:${PORT} (prefix=${PREFIX})`)
);
