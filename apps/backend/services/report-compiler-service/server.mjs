import express from "express";
import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";

const app = express();
app.use(express.json());

// ---- Config ----
const PORT = Number(process.env.PORT || 8000);
const API_KEY = process.env.API_KEY || "";
const DISABLE_AUTH = String(process.env.DISABLE_AUTH || "false").toLowerCase() === "true";
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/data/artifacts";
const FALLBACK_PDF = path.resolve("/app/assets/fallbacks/truststrip.pdf");

// ---- Helpers ----
async function fileExists(p) {
  try { await fsp.access(p, fs.constants.R_OK); return true; }
  catch { return false; }
}

function auth(req, res, next) {
  if (DISABLE_AUTH) return next();
  if (req.path === "/health") return next();
  const key = req.header("x-api-key") || "";
  if (API_KEY && key === API_KEY) return next();
  return res.status(401).json({ ok: false, error: "Unauthorized" });
}

// Ensure artifact dir
await fsp.mkdir(ARTIFACT_DIR, { recursive: true });

// ---- Routes ----
app.get("/health", (_req, res) => {
  res.type("application/json").send({ ok: true, ready: true });
});

app.use(auth);

// Build a real artifact (demo: copy fallback into /data/artifacts)
app.post("/build", async (req, res) => {
  const { template = "truststrip", period = "" } = req.body || {};
  if (template !== "truststrip") {
    return res.status(400).json({ ok: false, error: "Unsupported template" });
  }
  const artifactId = `rep_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const target = path.join(ARTIFACT_DIR, `${artifactId}.pdf`);
  try {
    await fsp.copyFile(FALLBACK_PDF, target);
    return res.json({ ok: true, artifactId });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// HEAD /artifacts/:id → 200 (fallback=1 if unknown)
app.head("/artifacts/:id", async (req, res) => {
  const pdfPath = path.join(ARTIFACT_DIR, `${req.params.id}.pdf`);
  const exists = await fileExists(pdfPath);
  if (!exists) {
    res.setHeader("X-Report-Fallback", "1");
  }
  return res.status(200).end();
});

// GET /artifacts/:id → serve real PDF or fallback inline
app.get("/artifacts/:id", async (req, res) => {
  const pdfPath = path.join(ARTIFACT_DIR, `${req.params.id}.pdf`);
  const exists = await fileExists(pdfPath);

  const src = exists ? pdfPath : FALLBACK_PDF;
  if (!exists) res.setHeader("X-Report-Fallback", "1");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${exists ? `${req.params.id}.pdf` : "fallback.pdf"}"`
  );

  const stream = fs.createReadStream(src);
  stream.on("error", (err) => res.status(500).end(String(err)));
  stream.pipe(res);
});

// ---- Start ----
app.listen(PORT, "0.0.0.0", () => {
  console.log(`report-compiler-service listening on :${PORT}`);
});
