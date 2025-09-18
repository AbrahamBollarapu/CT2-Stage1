// D:/CT2/apps/backend/services/kpi-calculation-service/server.mjs
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());

const SERVICE = "kpi-calculation-service";
const PORT = process.env.PORT || 8000;
const GW_BASE = process.env.GW_BASE || "http://traefik-ct2-demo:80";
const API_KEY = process.env.DEMO_API_KEY || "ct2-dev-key";

// ---------- helpers ----------
async function getJSON(url) {
  const r = await fetch(url, { headers: { "x-api-key": API_KEY } });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`GET ${url} -> ${r.status} ${r.statusText} ${txt}`);
  }
  return r.json();
}

async function fetchPoints({ org_id, meter, unit }) {
  // Try gateway first (preferred), then direct service (no prefix), then direct with prefix.
  const urls = [
    `${GW_BASE}/api/time-series/points?org_id=${encodeURIComponent(org_id)}&meter=${encodeURIComponent(meter)}&unit=${encodeURIComponent(unit)}`,
    `http://time-series-service:8000/points?org_id=${encodeURIComponent(org_id)}&meter=${encodeURIComponent(meter)}&unit=${encodeURIComponent(unit)}`,
    `http://time-series-service:8000/api/time-series/points?org_id=${encodeURIComponent(org_id)}&meter=${encodeURIComponent(meter)}&unit=${encodeURIComponent(unit)}`
  ];

  const attempts = [];
  for (const u of urls) {
    try {
      const j = await getJSON(u);
      const pts = Array.isArray(j.points) ? j.points : [];
      attempts.push({ url: u, ok: true, count: pts.length });
      if (pts.length > 0) return { points: pts, source: u, attempts };
    } catch (e) {
      attempts.push({ url: u, ok: false, error: `${e}` });
    }
  }
  // If everything failed or returned zero, still return the last attempt info
  return { points: [], source: urls[0], attempts };
}

function summarize(values) {
  const count = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = count ? sum / count : 0;
  const max = count ? Math.max(...values) : 0;
  return {
    total_energy_kwh: Number(sum.toFixed(3)),
    avg_daily_kwh: Number(avg.toFixed(3)),
    peak_kwh: Number(max.toFixed(3)),
    points_count: count
  };
}

// ---------- routes ----------
app.get("/api/kpi/health", (_req, res) => {
  res.json({ ok: true, service: SERVICE, ts: new Date().toISOString() });
});

// Debug endpoint: shows where KPI tried to fetch from
app.get("/api/kpi/debug/sources", async (req, res) => {
  const org_id = (req.query.org_id || "demo").toString();
  const meter  = (req.query.meter  || "grid_kwh").toString();
  const unit   = (req.query.unit   || "kWh").toString();
  const { attempts } = await fetchPoints({ org_id, meter, unit });
  res.json({ ok: true, attempts, gw_base: GW_BASE });
});

app.post("/api/kpi/compute", async (req, res) => {
  try {
    const { org_id = "demo", period = "2024Q4", meter = "grid_kwh", unit = "kWh" } = req.body || {};
    const { points, source, attempts } = await fetchPoints({ org_id, meter, unit });

    const values = points.map(p => Number(p.value)).filter(Number.isFinite);
    const kpis = summarize(values);

    res.json({
      ok: true,
      org_id, period, meter, unit,
      kpis,
      meta: {
        source: SERVICE,
        fetched_points: kpis.points_count,
        gw_base: GW_BASE,
        read_from: source,
        attempts
      }
    });
  } catch (err) {
    console.error("[kpi] compute error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

app.get("/", (_req, res) => res.type("text/plain").send(`${SERVICE} running`));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`${SERVICE} listening on http://0.0.0.0:${PORT}`);
});
