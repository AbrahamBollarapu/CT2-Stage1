import express from "express";
import cors from "cors";

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());

// Health at root (Traefik will StripPrefix /api/xmap)
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "xbrl-mapping-service", ts: new Date().toISOString() });
});

// Example route (reachable as /api/xmap/lookup)
app.get("/lookup", (req, res) => {
  const concept = (req.query.concept || "").toString();
  if (!concept) return res.status(400).json({ ok: false, error: "concept is required" });
  res.json({ ok: true, concept });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`xbrl-mapping-service listening on http://0.0.0.0:${PORT}`);
});
