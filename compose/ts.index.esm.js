/**
 * time-series-service (ESM)
 * Endpoints:
 *  - GET  /api/time-series/health
 *  - POST /api/time-series/points    { org_id, meter, unit, points:[{ts,value,tags?}] }
 *  - GET  /api/time-series/points?meter=&unit=&from=&to=&org_id=
 */
import express from "express";
import pkg from "pg";
const { Pool } = pkg;

// -------- trace middleware --------
function traceMiddleware(req, res, next) {
  const incoming = req.header("traceparent");
  const rand = () => Math.random().toString(16).slice(2);
  const traceId  = incoming?.split("-")[1] || (rand() + rand()).slice(0, 32).padEnd(32, "0");
  const parentId = incoming?.split("-")[2] || "".padEnd(16, "0");
  const traceparent = `00-${traceId}-${parentId}-01`;
  const corr = req.header("x-correlation-id") || rand().slice(0, 12);

  req._traceparent = traceparent; req._corr = corr;
  res.setHeader("traceparent", traceparent);
  res.setHeader("x-correlation-id", corr);

  const t0 = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - t0;
    console.log(`[trace=${traceparent}] [corr=${corr}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
}

// -------- DB --------
const rawUrl = process.env.DATABASE_URL || "";
// allow: postgresql+psycopg://user:pass@host:5432/db
const pgUrl  = rawUrl.replace(/^postgresql\+psycopg:\/\//, "postgres://");
const pool   = new Pool({ connectionString: pgUrl });

// -------- helpers --------
function toIsoOrThrow(v) {
  if (!v) throw new Error("missing timestamp");
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + "T00:00:00Z").toISOString();
  const d = new Date(v); if (isNaN(d.getTime())) throw new Error(`bad ts: ${v}`);
  return d.toISOString();
}
function toExclusiveEnd(to) {
  if (!to) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const d = new Date(to + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  }
  return new Date(to).toISOString();
}

// -------- app --------
const app = express();
app.use(traceMiddleware);
app.use(express.json({ limit: "25mb" }));

app.get("/api/time-series/health", async (_req, res) => {
  try { await pool.query("select 1"); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Bulk UPSERT: on conflict(org_id,meter,unit,ts) update value & merge tags
app.post("/api/time-series/points", async (req, res) => {
  try {
    const { org_id, meter, unit, points } = req.body || {};
    if (!org_id || !meter || !unit || !Array.isArray(points) || points.length === 0) {
      return res.status(400).json({ error: "org_id, meter, unit, points[] required" });
    }
    const values = [org_id, meter, unit];
    const rows = [];
    points.forEach((p, i) => {
      const tsIso = toIsoOrThrow(p.ts);
      if (typeof p.value !== "number") throw new Error("value must be number");
      const base = 4 + i * 3;
      rows.push(`($1,$2,$3,$${base},$${base+1},$${base+2})`);
      values.push(tsIso, p.value, JSON.stringify(p.tags ?? {}));
    });
    const sql = `
      insert into points (org_id, meter, unit, ts, value, tags)
      values ${rows.join(",")}
      on conflict (org_id, meter, unit, ts) do update
        set value = EXCLUDED.value,
            tags  = coalesce(points.tags, '{}'::jsonb) || EXCLUDED.tags
    `;
    const r = await pool.query(sql, values);
    res.json({ ok: true, written: r.rowCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Read
app.get("/api/time-series/points", async (req, res) => {
  try {
    const meter = req.query.meter, unit = req.query.unit;
    if (!meter || !unit) return res.status(400).json({ error: "meter & unit required" });

    const params = [meter, unit];
    const where = ["meter = $1", "unit = $2"];

    const org_id = req.query.org_id ?? null;
    if (org_id) { params.push(org_id); where.push(`org_id = $${params.length}`); }
    if (req.query.from) { params.push(toIsoOrThrow(String(req.query.from))); where.push(`ts >= $${params.length}`); }
    if (req.query.to)   { params.push(toExclusiveEnd(String(req.query.to)));   where.push(`ts <  $${params.length}`); }

    const q = `select ts, value, tags from points where ${where.join(" and ")} order by ts asc`;
    const r = await pool.query(q, params);
    res.json({
      meter, unit,
      points: r.rows.map(x => ({
        ts: new Date(x.ts).toISOString(),
        value: Number(x.value),
        tags: x.tags ?? {}
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = Number(process.env.PORT || 8000);
app.listen(PORT, () => console.log("[time-series-service] listening on", PORT));
