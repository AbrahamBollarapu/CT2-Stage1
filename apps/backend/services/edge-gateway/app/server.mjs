import express from "express";
import fetch from "node-fetch";

const PORT = process.env.PORT || 8000;
const TS_URL = process.env.TIME_SERIES_URL || "http://time-series-service:8000";

const DEV_TOKEN = process.env.TS_AUTH || process.env.TS_AUTH_TOKEN || process.env.TIME_SERIES_AUTH || "dev";
const authHeaders = {
  // try common shapes in dev builds
  Authorization: DEV_TOKEN.startsWith("Bearer ") ? DEV_TOKEN : `Bearer ${DEV_TOKEN}`,
  "x-api-key": DEV_TOKEN,
  "x-ct2-auth": DEV_TOKEN,
  "x-auth-token": DEV_TOKEN,
  "x-dev-key": DEV_TOKEN,
};

const UNIT_MAP = { grid_kwh: "kwh", temp_c: "c", co2_ppm: "ppm" };
const unitFor = (metric, provided) => (provided && String(provided).trim()) || UNIT_MAP[metric];

const app = express();
app.use(express.json({ limit: "1mb" }));
app.get("/health", (_req, res) => res.json({ ok: true, svc: "edge-gateway" }));

app.post("/api/edge/ingest", async (req, res) => {
  try {
    let org_id = req.body?.org_id || req.query.org_id;
    let metric = req.body?.metric || req.query.metric;
    let meter  = req.body?.meter  || req.query.meter;
    let unit   = req.body?.unit   || req.query.unit;

    let points = [];
    if (Array.isArray(req.body)) {
      for (const p of req.body) {
        org_id ||= p.org_id; metric ||= p.metric; meter ||= p.meter; unit ||= p.unit;
        if (p?.ts && typeof p?.value === "number") points.push({ ts: p.ts, value: p.value });
      }
    } else if (req.body?.points && Array.isArray(req.body.points)) {
      points = req.body.points.filter(p => p?.ts && typeof p?.value === "number").map(p => ({ ts: p.ts, value: p.value }));
      org_id ||= req.body.org_id; metric ||= req.body.metric; meter ||= req.body.meter; unit ||= req.body.unit;
    } else if (req.body?.ts && typeof req.body?.value === "number") {
      points = [{ ts: req.body.ts, value: req.body.value }];
    }

    if (!points.length) return res.status(400).json({ ok:false, error:"expected { points:[{ts,value}] } or array" });
    if (!org_id || !metric || !meter) return res.status(400).json({ ok:false, error:"missing org_id/metric/meter" });

    unit = unitFor(metric, unit);

    const url = `${TS_URL}/api/time-series/points?` + new URLSearchParams({
      org_id, metric, meter, ...(unit ? { unit } : {})
    }).toString();

    const up = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ points }),
    });

    const text = await up.text().catch(() => "");
    if (!up.ok) return res.status(502).json({ ok:false, upstream: up.status, body: text.slice(0, 400) });
    return res.json({ ok:true, queued: points.length, unit: unit || null });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e) });
  }
});

app.listen(PORT, "0.0.0.0", () => console.log(`edge-gateway listening on ${PORT}`));
