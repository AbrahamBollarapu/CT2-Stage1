// D:/CT2/apps/backend/services/xbrl-mapping-service/server.mjs
import express from "express";
import cors from "cors";

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());

// --- Constants (demo-safe) ---
const SERVICE = "xbrl-mapping-service";
const VERSION = "1.0.0";

// Health
app.get("/api/xbrl/health", (req, res) => {
  res.json({ ok: true, service: SERVICE, version: VERSION, ts: new Date().toISOString() });
});

// Coverage badge (deterministic demo)
app.get("/api/xbrl/coverage", (req, res) => {
  const company_id = (req.query.company_id || "demo").toString();
  const period = (req.query.period || "2024Q4").toString();
  const standard = (req.query.standard || "ESRS").toString(); // or "SEC", "GHG"

  // Demo: pretend we check mappings & validation and produce a coverage badge
  const total_requirements = 5;
  const covered = 5;
  const violations = 0;
  const score = 5;

  const payload = {
    ok: true,
    company_id,
    period,
    standard,
    coverage: {
      score,
      covered,
      total_requirements,
      violations,
      details: [
        { id: "E1-1", name: "GHG Scope 1", covered: true, violations: 0 },
        { id: "E1-2", name: "GHG Scope 2", covered: true, violations: 0 },
        { id: "E1-3", name: "GHG Scope 3", covered: true, violations: 0 },
        { id: "G1-1", name: "Gov. Disclosure Controls", covered: true, violations: 0 },
        { id: "XBRL-VAL", name: "Inline XBRL validation", covered: true, violations: 0 },
      ],
    },
    badge: {
      label: "iXBRL Coverage",
      message: `${covered}/${total_requirements} • ${violations} errors`,
      color: violations === 0 ? "green" : "orange",
    },
    // Helpful for UI tiles
    meta: {
      generated_at: new Date().toISOString(),
      engine: SERVICE,
      version: VERSION,
    },
  };

  res.json(payload);
});

// Minimal mapping lookup stub (optional helper)
app.get("/api/xmap/lookup", (req, res) => {
  const concept = (req.query.concept || "").toString();
  if (!concept) {
    return res.status(400).json({ ok: false, error: "concept is required" });
  }
  // Demo mapping
  const demo = {
    concept,
    taxonomy: "ESRS",
    elements: [
      { qname: "esrs:E11Scope1Emissions", type: "monetaryItemType", balance: "debit" },
      { qname: "esrs:E11Scope2Emissions", type: "monetaryItemType", balance: "debit" },
    ],
  };
  res.json({ ok: true, mapping: demo });
});

// Root (optional)
app.get("/", (req, res) => {
  res.type("text/plain").send(`${SERVICE} ${VERSION} is running`);
});

// Error handler (last)
app.use((err, req, res, next) => {
  console.error("[xbrl] error:", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

const PORT = process.env.PORT || 8009;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`${SERVICE} ${VERSION} listening on http://0.0.0.0:${PORT}`);
});
