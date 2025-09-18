// D:/CT2/apps/backend/services/search-index-service/server.mjs
import express from "express";
import cors from "cors";

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());

const SERVICE = "search-index-service";
const PORT = process.env.PORT || 8000;

// Demo index
const DEMO_DOCS = [
  { id: "doc_esg_intro",   title: "ESG Overview",           tags: ["esg","intro"],    score: 0.92 },
  { id: "doc_kpi_demo",    title: "KPI Demo Metrics",       tags: ["kpi","demo"],     score: 0.88 },
  { id: "doc_xbrl_guide",  title: "iXBRL Coverage Guide",   tags: ["xbrl","guide"],   score: 0.90 },
  { id: "doc_evidence_api",title: "Evidence API Reference", tags: ["evidence","api"], score: 0.86 }
];

app.get("/api/search/health", (_req, res) => {
  res.json({ ok: true, service: SERVICE, ts: new Date().toISOString() });
});

app.get("/api/search/query", (req, res) => {
  const q = (req.query.q || "").toString().toLowerCase();
  const results = q
    ? DEMO_DOCS
        .map(d => ({ ...d, match:
          (d.title.toLowerCase().includes(q) ? 2 : 0) +
          (d.tags.some(t => t.includes(q)) ? 1 : 0)
        }))
        .filter(d => d.match > 0)
        .sort((a,b) => (b.match + b.score) - (a.match + a.score))
    : DEMO_DOCS.slice().sort((a,b) => b.score - a.score);

  res.json({ ok: true, q, count: results.length, results });
});

app.get("/", (_req, res) => res.type("text/plain").send(`${SERVICE} running`));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`${SERVICE} listening on http://0.0.0.0:${PORT}`);
});
