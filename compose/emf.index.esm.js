/**
 * emission-factors-service (ESM)
 * Endpoints:
 *  - GET  ${PREFIX}/health
 *  - GET  ${PREFIX}?meter=&unit=
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
  const t0=Date.now(); res.on("finish",()=>console.log(`[trace=${tp}] [corr=${corr}] ${req.method} ${req.path} ${res.statusCode} ${Date.now()-t0}ms`));
  next();
}

const app = express();
app.use(traceMiddleware);
app.use(express.json({limit:"1mb"}));

const PREFIX = process.env.PREFIX || "/api/emission-factors";

/** Static factors (stub) keyed by "meter|unit" */
const FACTORS = {
  "grid_kwh|kWh": { factor: 0.82, ef_unit: "kgCO2e/kWh", source: "static" },
  // add more here as needed
};

app.get(`${PREFIX}/health`, (_req, res) => res.json({ ok:true, service:"emission-factors" }));

app.get(PREFIX, (req, res) => {
  const meter = String(req.query.meter || "");
  const unit  = String(req.query.unit  || "");
  if (!meter || !unit) return res.status(400).json({ error:"meter & unit required" });
  const key = `${meter}|${unit}`;
  const ef = FACTORS[key];
  if (!ef) return res.status(404).json({ error:`no factor for ${meter}/${unit}` });
  res.json({ meter, unit, ...ef });
});

const PORT = Number(process.env.PORT || 8000);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[emission-factors] listening on ${PORT} (prefix=${PREFIX})`);
});
