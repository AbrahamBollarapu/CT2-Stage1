import express from "express";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";

type BlobRecord = {
  filename: string;
  contentType: string;
  bytes: Buffer;
};

const store = new Map<string, Map<string, BlobRecord>>(); // orgId -> evidence_id -> record

const app = express();
app.use(express.json({ limit: "25mb" }));

const PORT = parseInt(process.env.PORT || "8000", 10);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Traefik strips /api/evidence → our route is /documents
app.post("/documents", (req, res) => {
  try {
    const orgId = (req.header("X-Org-Id") || "default").toString();
    const { filename, contentType, dataBase64 } = req.body || {};
    if (!filename || !contentType || !dataBase64) {
      return res
        .status(400)
        .json({ ok: false, error: "filename, contentType, dataBase64 required" });
    }
    const bytes = Buffer.from(String(dataBase64), "base64");
    const evidence_id = crypto.randomUUID();

    const perOrg = store.get(orgId) || new Map<string, BlobRecord>();
    perOrg.set(evidence_id, { filename, contentType, bytes });
    store.set(orgId, perOrg);

    return res.json({ ok: true, evidence_id });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "error" });
  }
});

// HEAD /:evidence_id/content  (no body, just headers)
app.head("/:evidence_id/content", (req, res) => {
  const orgId = (req.header("X-Org-Id") || "default").toString();
  const evidence_id = req.params.evidence_id;
  const perOrg = store.get(orgId);
  const rec = perOrg?.get(evidence_id);
  if (!rec) return res.sendStatus(404);
  res.setHeader("Content-Type", rec.contentType);
  res.setHeader("Content-Length", String(rec.bytes.length));
  return res.status(200).end();
});

// GET /:evidence_id/content → raw bytes
app.get("/:evidence_id/content", (req, res) => {
  const orgId = (req.header("X-Org-Id") || "default").toString();
  const evidence_id = req.params.evidence_id;
  const perOrg = store.get(orgId);
  const rec = perOrg?.get(evidence_id);
  if (!rec) return res.status(404).json({ ok: false, error: "not found" });
  res.setHeader("Content-Type", rec.contentType);
  res.setHeader("Content-Length", String(rec.bytes.length));
  return res.status(200).send(rec.bytes);
});

app.listen(PORT, () => {
  console.log(`evidence-store listening on :${PORT}`);
});
