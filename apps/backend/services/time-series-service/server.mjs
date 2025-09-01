import express from "express";

const app = express();
app.use(express.json());
const PORT = Number(process.env.PORT || 8000);

const points = []; // {metric, period, account, ts, value}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "time-series-service", port: PORT });
});

app.post("/points", (req, res) => {
  const arr = Array.isArray(req.body) ? req.body : [req.body];
  arr.forEach(p => points.push({ ...p, ts: p.ts || Date.now() }));
  res.json({ ok: true, inserted: arr.length });
});

app.get("/query", (req, res) => {
  const { metric, period, account } = req.query;
  const out = points.filter(p =>
    (metric ? p.metric === metric : true) &&
    (period ? p.period === period : true) &&
    (account ? p.account === account : true)
  );
  res.json({ ok: true, count: out.length, points: out });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[time-series-service] listening on ${PORT}`);
});
