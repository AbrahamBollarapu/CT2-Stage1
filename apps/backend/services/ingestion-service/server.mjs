// D:/CT2/apps/backend/services/ingestion-service/server.mjs
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable("x-powered-by");
app.use(cors());

// Dev-mode auth: accept optional x-api-key (no-op)
app.use((req, _res, next) => { /* could log x-api-key/x-org-id here */ next(); });

app.get("/api/ingest/health", (_req, res) => {
  res.json({ ok: true, service: "ingestion-service", ts: new Date().toISOString() });
});

const EVIDENCE_DIR = process.env.EVIDENCE_DIR || "/data/evidence";
await fsp.mkdir(EVIDENCE_DIR, { recursive: true });

// Multer (memory storage → we write to shared volume)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }); // 25 MB

/**
 * POST /api/ingest/documents
 * multipart/form-data:
 *   - file: (binary)
 *   - org_id: string
 *   - tags?: string
 *
 * Returns: { ok, evidence_id, job_id, filename, size }
 */
app.post("/api/ingest/documents", upload.single("file"), async (req, res) => {
  try {
    const org_id = (req.body.org_id || "").toString().trim();
    if (!org_id) {
      return res.status(400).json({ ok: false, error: "org_id is required" });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "file is required" });
    }

    const originalName = req.file.originalname || "upload.bin";
    const contentType = req.file.mimetype || "application/octet-stream";
    const evidence_id = "ev_" + nanoid(12);
    const job_id = "job_" + nanoid(10);

    // Destination paths in shared volume
    const base = path.join(EVIDENCE_DIR, evidence_id);
    const dataPath = base;                  // no extension
    const metaPath = base + ".json";        // adjacent metadata

    // Write file bytes
    await fsp.writeFile(dataPath, req.file.buffer);

    // Write metadata (include original filename and content type)
    const meta = {
      evidence_id,
      org_id,
      filename: originalName,
      content_type: contentType,
      size: req.file.size,
      created_at: new Date().toISOString()
    };
    await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");

    res.json({ ok: true, evidence_id, job_id, filename: originalName, size: req.file.size });
  } catch (err) {
    console.error("[ingestion] error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// Root text for quick curl
app.get("/", (_req, res) => res.type("text/plain").send("ingestion-service running"));

const PORT = process.env.PORT || 8000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`ingestion-service listening on http://0.0.0.0:${PORT}`);
});
