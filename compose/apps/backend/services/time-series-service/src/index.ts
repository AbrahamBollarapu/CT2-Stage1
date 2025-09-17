import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));

// key = `${meter}|${unit}` -> array of {ts, value}
const store = new Map<string, Array<{ ts: number; value: number }>>();
const key = (m: string, u: string) => `${m}|${u}`;

app.get("/api/time-series/health", (_req, res) => res.json({ ok: true }));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/time-series/points", (req, res) => {
  const { meter, unit, points } = req.body || {};
  if (!meter || !unit || !Array.isArray(points)) {
    return res.status(400).json({ error: "meter, unit, points[] required" });
  }
  const arr = store.get(key(meter, unit)) || [];
  let written = 0;
  for (const p of points) {
    const t = typeof p.ts === "string" ? Date.parse(p.ts) : Number(p.ts);
    const v = Number(p.value);
    if (Number.isFinite(t) && Number.isFinite(v)) { arr.push({ ts: t, value: v }); written++; }
  }
  arr.sort((a, b) => a.ts - b.ts);
  store.set(key(meter, unit), arr);
  res.json({ ok: true, written });
});

app.get("/api/time-series/points", (req, res) => {
  const meter = String(req.query.meter || "");
  const unit = String(req.query.unit || "");
  const sinceQ = String((req.query as any).since || "");
  if (!meter || !unit) return res.status(400).json({ error: "meter & unit required" });
  const since = sinceQ && !Number.isNaN(Date.parse(sinceQ)) ? Date.parse(sinceQ) : 0;
  const arr = (store.get(key(meter, unit)) || []).filter((p) => p.ts >= since);
  res.json({ meter, unit, points: arr.map((p) => ({ ts: new Date(p.ts).toISOString(), value: p.value })) });
});

const PORT = Number(process.env.PORT || 8000);
app.listen(PORT, () => console.log("[time-series-service] listening on", PORT));
export default app;
