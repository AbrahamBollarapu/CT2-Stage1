import express from "express";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

// POST /api/ingest/documents   (raw body: application/pdf|octet-stream)
router.post("/", async (req, res) => {
  try {
    const buf = req.body as Buffer;
    if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) {
      return res.status(400).json({ error: "empty body" });
    }

    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

    const base = process.env.EVIDENCE_DIR || "/data/evidence";
    const dir = path.resolve(base, sha256.slice(0, 2));
    const file = path.join(dir, `${sha256}.bin`);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file, buf);

    return res.json({ ok: true, sha256, bytes: buf.length });
  } catch (err: any) {
    console.error("[ingest] upload error:", err?.message || err);
    return res.status(500).json({ error: "upload failed" });
  }
});

export default router;
