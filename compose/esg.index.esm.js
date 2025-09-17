/**
 * esg-service (ESM)
 * POST  /api/esg/footprint { org_id, meter, unit, from, to }
 * GET   /api/esg/health
 */
import express from "express";

function traceMiddleware(req, res, next) {
  const incoming = req.header("traceparent");
  const rand = () => Math.random().toString(16).slice(2);
  const traceId  = incoming?.split("-")[1] || (rand()+rand()).slice(0,32).padEnd(32,"0");
  const parentId = incoming?.split("-")[2] || "".padEnd(16,"0");
  const tp = `00-${traceId}-${parentId}-01`;
  const corr = req.header("x-correlation-id") || rand().slice(0,12);
  req._traceparent = tp; req._corr = corr;
  res.setHeader("traceparent", tp);
  res.setHeader("x-correlation-id", corr);
  const t0 = Date.now();
  res.on("finish", ()=>console.log(`[trace=${tp}] [corr=${corr}] ${req.method} ${req.path} ${res.statusCode} ${Date.now()-t0}ms`));
  next();
}

const app = express();
app.use(traceMiddleware);
app.use(express.json({ limit: "1mb" }));

const PREFIX = "/api/esg";
const TS_API = process.env.TS_API || "http://time-series-service:8000";
const EF_API = process.env.EF_API || "http://emission-factors-service:8000";

// health at root and prefixed to tolerate Traefik behavior
app.get("/health", (_req,res)=>res.json({ok:true, service:"esg", root:true}));
app.get(`${PREFIX}/health`, (_req,res)=>res.json({ok:true, service:"esg"}));

function toIso(v) {
  if (!v) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v+"T00:00:00Z").toISOString();
  const d = new Date(v); if (isNaN(d.getTime())) throw new Error(`bad ts: ${v}`);
  return d.toISOString();
}

app.post(`${PREFIX}/footprint`, async (req, res) => {
  try {
    const { org_id, meter, unit, from, to } = req.body || {};
    if (!org_id || !meter || !unit) return res.status(400).json({ error:"org_id, meter, unit required" });

    // 1) emission factor
    const efUrl = new URL("/", EF_API);
    efUrl.searchParams.set("meter", meter);
    efUrl.searchParams.set("unit", unit);
    const efResp = await fetch(efUrl, { headers: { traceparent: req._traceparent, "x-correlation-id": req._corr }});
    if (!efResp.ok) return res.status(efResp.status).json({ error:`EF lookup failed (${efResp.status})` });
    const ef = await efResp.json(); // {factor, ef_unit}

    // 2) time-series window
    const tsUrl = new URL("/api/time-series/points", TS_API);
    tsUrl.searchParams.set("meter", meter);
    tsUrl.searchParams.set("unit", unit);
    tsUrl.searchParams.set("org_id", org_id);
    if (from) tsUrl.searchParams.set("from", from);
    if (to)   tsUrl.searchParams.set("to", to);
    const tsResp = await fetch(tsUrl, { headers: { traceparent: req._traceparent, "x-correlation-id": req._corr }});
    if (!tsResp.ok) return res.status(tsResp.status).json({ error:`TS fetch failed (${tsResp.status})` });
    const series = await tsResp.json(); // {points:[{ts,value,tags}]}

    const kWh = (series.points || []).reduce((s,p)=>s + Number(p.value||0), 0);
    const kgCO2e = kWh * Number(ef.factor);

    res.json({
      ok: true,
      inputs: { org_id, meter, unit, from: from?toIso(from):undefined, to: to?toIso(to):undefined },
      factor: ef,
      totals: { energy_kWh: kWh, emissions_kgCO2e: kgCO2e },
      points: series.points?.length ?? 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = Number(process.env.PORT || 8000);
app.listen(PORT, "0.0.0.0", ()=>console.log(`[esg] listening on ${PORT} (TS_API=${TS_API}, EF_API=${EF_API})`));
