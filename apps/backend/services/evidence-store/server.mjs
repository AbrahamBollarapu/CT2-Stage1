// D:/CT2/apps/backend/services/evidence-store/server.mjs
import express from "express";
import cors from "cors";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());

const SERVICE = "evidence-store";
const PORT = process.env.PORT || 8000;
const EVIDENCE_DIR = process.env.EVIDENCE_DIR || "/data/evidence";

await fsp.mkdir(EVIDENCE_DIR, { recursive: true });

app.get("/api/evidence/health", (_req, res) => {
  res.json({ ok: true, service: SERVICE, ts: new Date().toISOString() });
});

// Helper to read meta
async function loadMeta(evidence_id) {
  const metaPath = path.join(EVIDENCE_DIR, evidence_id + ".json");
  const buf = await fsp.readFile(metaPath, "utf8");
  return JSON.parse(buf);
}

// HEAD /api/evidence/:id/content
app.head("/api/evidence/:id/content", async (req, res) => {
  try {
    const evidence_id = req.params.id;
    const dataPath = path.join(EVIDENCE_DIR, evidence_id);
    const stat = await fsp.stat(dataPath).catch(() => null);
    if (!stat) return res.sendStatus(404);

    let meta = { filename: "content.bin", content_type: "application/octet-stream", size: stat.size };
    try { meta = await loadMeta(evidence_id); } catch (_) {}

    res.setHeader("Content-Type", meta.content_type || "application/octet-stream");
    res.setHeader("Content-Length", meta.size?.toString() || stat.size.toString());
    res.setHeader("Content-Disposition", `inline; filename="${meta.filename || "content.bin"}"`);
    return res.status(200).end();
  } catch (err) {
    console.error("[evidence HEAD] error:", err);
    return res.sendStatus(500);
  }
});

// GET /api/evidence/:id/content
app.get("/api/evidence/:id/content", async (req, res) => {
  try {
    const evidence_id = req.params.id;
    const dataPath = path.join(EVIDENCE_DIR, evidence_id);
    const stat = await fsp.stat(dataPath).catch(() => null);
    if (!stat) return res.sendStatus(404);

    let meta = { filename: "content.bin", content_type: "application/octet-stream", size: stat.size };
    try { meta = await loadMeta(evidence_id); } catch (_) {}

    res.setHeader("Content-Type", meta.content_type || "application/octet-stream");
    res.setHeader("Content-Length", meta.size?.toString() || stat.size.toString());
    res.setHeader("Content-Disposition", `inline; filename="${meta.filename || "content.bin"}"`);

    const stream = fs.createReadStream(dataPath);
    stream.on("error", (e) => {
      console.error("[evidence GET] stream error:", e);
      if (!res.headersSent) res.status(500).json({ ok: false, error: "stream_error" });
    });
    stream.pipe(res);
  } catch (err) {
    console.error("[evidence GET] error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// Root
app.get("/", (_req, res) => res.type("text/plain").send(`${SERVICE} running`));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`${SERVICE} listening on http://0.0.0.0:${PORT}`);
});
