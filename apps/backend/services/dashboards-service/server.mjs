// apps/backend/services/dashboards-service/server.mjs
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 8000;

// Health endpoint
app.get("/health", (_req, res) => res.json({ ok: true, svc: "dashboards-service" }));

// Static assets (disable entity validators so index.html isn't cached via etag/last-modified)
const pub = path.join(__dirname, "public");
app.use(express.static(pub, {
  etag: false,
  lastModified: false,
  cacheControl: false
}));

// Serve SPA entry with explicit no-store caching
function sendIndex(_req, res) {
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(pub, "index.html"));
}

// SPA entrypoints
app.get("/", sendIndex);
app.get("/dashboard", sendIndex);

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`dashboards-service on :${PORT}`);
});
