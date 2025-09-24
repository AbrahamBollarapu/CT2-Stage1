// Minimal, clinical edge-gateway that forwards unit to Time-Series.
//
// Accepted bodies:
//  A) { org_id, metric, meter, unit?, points:[{ts,value}] }
//  B) [{ org_id, metric, meter, unit?, ts, value }, ...]
//  C) { ts, value } + ids in query (?org_id=..&metric=..&meter=..&unit=..)
//
// Forwards to Time-Series:
//  POST /api/time-series/points?org_id=..&metric=..&meter=..&unit=..
//  body: { points:[{ts,value}] }

import express from "express";
import fetch from "node-fetch";

const PORT = process.env.PORT || 8000;
const TIME_SERIES_URL = process.env.TIME_SERIES_URL || "http://time-series-service:8000";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "edge-gateway" }));

// Simple metric→unit inference so older callers (no unit) still work
const UNIT_MAP = {
  grid_kwh: "kwh",
  temp_c: "c",
  co2_ppm: "ppm",
};
const unitFor = (metric, provided) => (provided && String(provided).trim()) || UNIT_MAP[metric];

app.post("/api/edge/ingest", async (req, res) => {
  try {
    let org_id = req.body?.org_id || req.query.org_id;
    let metric = req.body?.metric || req.query.metric;
    let meter  = req.body?.meter  || req.query.meter;
    let unit   = req.body?.unit   || req.query.unit;

    let points = [];

    if (Array.isArray(req.body)) {
      for (const p of req.body) {
        if (!org_id) org_id = p.org_id;
        if (!metric) metric = p.metric;
        if (!meter)  meter  = p.meter;
        if (!unit)   unit   = p.unit;
        if (p?.ts && typeof p?.value === "number") points.push({ ts: p.ts, value: p.value });
      }
    } else if (req.body?.points && Array.isArray(req.body.points)) {
      points = req.body.points
        .filter((p) => p?.ts && typeof p?.value === "number")
        .map((p) => ({ ts: p.ts, value: p.value }));
      org_id = org_id || req.body.org_id;
      metric = metric || req.body.metric;
      meter  = meter  || req.body.meter;
      unit   = unit   || req.body.unit;
    } else if (req.body?.ts && typeof req.body?.value === "number") {
      points = [{ ts: req.body.ts, value: req.body.value }];
    }

    if (!points.length) {
      return res.status(400).json({ ok: false, error: "expected { points:[{ts,value}] } or array" });
    }
    if (!org_id || !metric || !meter) {
      return res.status(400).json({ ok: false, error: "missing org_id/metric/meter" });
    }

    // Ensure unit forwarded (infer if omitted)
    unit = unitFor(metric, unit);

    const url =
      `${TIME_SERIES_URL}/api/time-series/points` +
      `?org_id=${encodeURIComponent(org_id)}` +
      `&metric=${encodeURIComponent(metric)}` +
      `&meter=${encodeURIComponent(meter)}` +
      (unit ? `&unit=${encodeURIComponent(unit)}` : "");

    const up = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    });

    if (!up.ok) {
      const t = await up.text().catch(() => "");
      return res.status(502).json({ ok: false, upstream: up.status, body: t.slice(0, 400) });
    }

    res.json({ ok: true, queued: points.length, unit: unit || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`edge-gateway listening on ${PORT}`);
});
