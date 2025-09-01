import express from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: "uploads/" });

const PORT = Number(process.env.PORT || 8000);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ingestion-service", port: PORT });
});

// Dev API key gate (simple)
app.use((req, res, next) => {
  const needKey = process.env.REQUIRE_DEV_KEY === "true";
  if (!needKey) return next();
  if (req.headers["x-api-key"] === (process.env.DEV_API_KEY || "dev-123")) return next();
  return res.status(401).json({ error: "unauthorized" });
});

app.post("/documents", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file required" });
  const buf = fs.readFileSync(req.file.path);
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  // Save under ./evidence-data to align with evidence-store expectation (mount a shared volume in compose)
  const outDir = path.join(__dirname, "evidence-data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, sha256);
  fs.renameSync(req.file.path, outPath);
  const jobId = "job_" + Date.now();
  res.json({ ok: true, jobId, sha256 });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[ingestion-service] listening on ${PORT}`);
});
