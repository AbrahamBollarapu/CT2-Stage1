import { Router, json } from "express";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const router = Router();

// Allow larger JSON for base64 payloads
router.use(json({ limit: process.env.JSON_LIMIT || "25mb" }));

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/var/lib/ct2/artifacts";

// Ensure artifact directory exists
(async () => { try { await fs.mkdir(ARTIFACT_DIR, { recursive: true }); } catch {} })();

function sanitize(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 200);
}

// Health (namespaced)
router.get("/api/ingest/health", (_req, res) => res.json({ ok: true }));
router.get("/api/ingest/ready",  (_req, res) => res.json({ ok: true }));

// D3 upload: POST /api/ingest/documents
router.post("/api/ingest/documents", async (req, res) => {
  try {
    const orgId = (req.header("X-Org-Id") || "demo").toString();
    const { filename, contentType, dataBase64 } = (req.body || {}) as {
      filename?: string; contentType?: string; dataBase64?: string;
    };
    if (!filename || !dataBase64) {
      return res.status(400).json({ error: "filename and dataBase64 required" });
    }

    const buf = Buffer.from(String(dataBase64), "base64");
    if (!buf.length) return res.status(400).json({ error: "dataBase64 empty" });

    const evidence_id = randomUUID();
    const safe = sanitize(filename);
    const base = path.join(ARTIFACT_DIR, evidence_id);

    // write artifact + sidecar metadata (evidence-store can read from same volume)
    await fs.writeFile(`${base}__${safe}`, buf);
    await fs.writeFile(`${base}.json`, JSON.stringify({
      evidence_id, org_id: orgId, filename: safe,
      contentType: contentType || "application/octet-stream",
      bytes: buf.length, created_at: new Date().toISOString(),
      source: "ingestion-service",
    }, null, 2));

    return res.status(201).json({ evidence_id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "ingest failed" });
  }
});

export default router;
