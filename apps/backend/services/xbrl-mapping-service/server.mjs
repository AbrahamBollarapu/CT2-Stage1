// server.mjs
import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;

app.get("/health", (_req, res) => res.json({ ok: true, ready: true }));

// Minimal lookup stub consumed by the compiler
app.post("/api/xmap/lookup", (req, res) => {
  // optionally read fields from req.body to vary values
  res.json({
    ok: true,
    tags: {
      companyName: "TrustStrip Inc.",
      periodLabel: "Q4 2024",
      totalEmissions: "12,345 tCO2e",
      reviewer: "Demo Bot",
    },
  });
});

app.get('/api/xbrl/coverage', (req, res) => {
  const { company_id, period } = req.query;
  res.json({ ok: true, company_id, period, score: 5, max: 5, errors: 0 });
});

app.listen(PORT, () => console.log(`xmap listening on :${PORT}`));
