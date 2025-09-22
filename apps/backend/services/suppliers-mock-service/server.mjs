import express from "express";

const app = express();
app.use(express.json());

const PORT   = process.env.PORT   || 8000;
const APIKEY = process.env.API_KEY || "ct2-dev-key";

const suppliers = [
  { id: 1, org_id: "test-org", name: "Acme Fasteners", country: "IN", created_at: new Date(Date.now()-86400000*3).toISOString() },
  { id: 2, org_id: "test-org", name: "Zen Plastics",   country: "AE", created_at: new Date(Date.now()-86400000*2).toISOString() },
  { id: 3, org_id: "test-org", name: "Orbit Steel",    country: "IN", created_at: new Date(Date.now()-86400000*1).toISOString() },
];

app.use((req, res, next) => {
  if (req.headers["x-api-key"] !== APIKEY) {
    return res.status(401).json({ error: "invalid api key" });
  }
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, svc: "suppliers-mock-service" }));

app.get("/api/suppliers", (req, res) => {
  const { org_id, country, page = "1", page_size = "25" } = req.query;
  let data = suppliers.slice();
  if (org_id)  data = data.filter(s => s.org_id === org_id);
  if (country) data = data.filter(s => s.country === country);

  const p  = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.max(1, Math.min(100, parseInt(page_size, 10) || 25));
  const start = (p - 1) * ps;
  const items = data.slice(start, start + ps);

  res.json({ count: data.length, page: p, page_size: ps, items });
});

app.get("/api/suppliers/:id", (req, res) => {
  const s = suppliers.find(x => String(x.id) === String(req.params.id));
  if (!s) return res.status(404).json({ error: "not found" });
  res.json(s);
});

app.listen(PORT, "0.0.0.0", () => console.log(`suppliers-mock-service on :${PORT}`));
