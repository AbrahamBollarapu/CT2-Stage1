// routes/ingest.ts
import { Router } from "express";
const r = Router();

// TODO: replace this with your real persistence (DB + artifact write)
// This should return a new evidence id (string/uuid).
async function saveEvidence(opts: {
  orgId: string;
  filename: string;
  contentType?: string;
  data: Buffer;
}): Promise<string> {
  // example only — implement your real save and return id
  // throw new Error("saveEvidence not implemented");
  return crypto.randomUUID();
}

r.post("/ingest/documents", async (req, res) => {
  try {
    const orgId = req.get("X-Org-Id") || "demo";
    const { filename, contentType, dataBase64 } = req.body || {};
    if (!filename || !dataBase64) {
      return res.status(400).json({ error: "filename and dataBase64 required" });
    }
    const buf = Buffer.from(String(dataBase64), "base64");
    const evidence_id = await saveEvidence({ orgId, filename, contentType, data: buf });
    return res.status(201).json({ evidence_id });
  } catch (e:any) {
    return res.status(500).json({ error: e?.message || "ingest failed" });
  }
});

export default r;
