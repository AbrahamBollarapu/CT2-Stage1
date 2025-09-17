// server.mjs
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;
const API_KEY = process.env.API_KEY || "ct2-dev-key";
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/artifacts";
const FALLBACK_PDF = path.join(__dirname, "assets", "fallbacks", "truststrip.pdf");

// in-memory job status
const JOBS = new Map(); // id -> { status, path, startedAt, template, period }

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const log = (...args) => console.log("[reports]", ...args);

app.get("/health", (_req, res) => res.json({ ok: true, ready: true }));

function guardKey(req, res, next) {
  // keep it super light for demo
  return next();
}

// --- Build ---
app.post("/build", guardKey, async (req, res) => {
  const { template = "truststrip", period = "2024Q4" } = req.body || {};
  const id = "rep_" + Date.now().toString() + "_" + crypto.randomBytes(3).toString("hex");
  const outPath = path.join(ARTIFACT_DIR, `${id}.pdf`);

  JOBS.set(id, { status: "queued", path: outPath, startedAt: Date.now(), template, period });

  log("build:start", { id, template, period, outPath });

  // DEMO IMPLEMENTATION:
  // simulate compile work then write a PDF (copy fallback as the artifact)
  setTimeout(() => {
    try {
      fs.copyFileSync(FALLBACK_PDF, outPath);
      JOBS.get(id).status = "completed";
      log("build:completed", { id, path: outPath, size: fs.statSync(outPath).size });
    } catch (e) {
      JOBS.get(id).status = "failed";
      log("build:failed", id, e?.message);
    }
  }, 400);

  return res.json({ ok: true, artifactId: id });
});

// --- Status ---
app.get("/status/:id", guardKey, (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).json({ ok: false, status: "unknown" });
  return res.json({ ok: true, status: job.status });
});

// --- Helpers for artifact responses ---
function sendPdfHeaders(res, filePath, filename, extra = {}) {
  const stat = fs.statSync(filePath);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Length": String(stat.size),
    "Content-Disposition": `inline; filename="${filename}"`,
    "Last-Modified": new Date(stat.mtimeMs).toUTCString(),
    ETag: crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"),
    ...extra,
  });
}

function resolveArtifactPath(id) {
  const job = JOBS.get(id);
  if (job?.path && fs.existsSync(job.path)) return { file: job.path, isFallback: false };
  if (fs.existsSync(FALLBACK_PDF)) return { file: FALLBACK_PDF, isFallback: true };
  return null;
}

// --- HEAD artifact ---
app.head("/artifacts/:id", guardKey, (req, res) => {
  const r = resolveArtifactPath(req.params.id);
  if (!r) return res.status(404).end();
  sendPdfHeaders(res, r.file, r.isFallback ? "fallback.pdf" : `${req.params.id}.pdf`, r.isFallback ? { "X-Fallback": "true" } : {});
  return res.status(200).end();
});

// --- GET artifact ---
app.get("/artifacts/:id", guardKey, (req, res) => {
  const r = resolveArtifactPath(req.params.id);
  if (!r) return res.status(404).json({ ok: false, error: "artifact not found" });
  sendPdfHeaders(res, r.file, r.isFallback ? "fallback.pdf" : `${req.params.id}.pdf`, r.isFallback ? { "X-Fallback": "true" } : {});
  const stream = fs.createReadStream(r.file);
  stream.pipe(res);
  log("artifact:served", { id: req.params.id, fallback: r.isFallback });
});

app.listen(PORT, () => log(`report-compiler listening on :${PORT}`));
