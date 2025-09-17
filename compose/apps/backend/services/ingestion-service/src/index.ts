import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "25mb" }));

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/var/lib/ct2/artifacts";
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const sanitize = (s: string) => s.replace(/[^\w.\- ]+/g, "_").slice(0, 180);
const nowIso = () => new Date().toISOString();

app.get("/api/ingest/health", (_req, res) =>
  res.json({ ok: true, service: "ingestion-service" })
);
app.get("/health", (_req, res) => res.json({ ok: true }));

async function handleJsonIngest(req: express.Request, res: express.Response) {
  try {
    const orgId = String(req.header("X-Org-Id") || "").trim() || "default";
    const { filename, contentType, dataBase64 } = req.body || {};
    if (!filename || !contentType || !dataBase64) {
      return res.status(400).json({ error: "filename, contentType, dataBase64 required" });
    }
    const id = crypto.randomUUID();
    const safe = sanitize(String(filename));
    const metaPath = path.join(ARTIFACT_DIR, `${id}.json`);
    const filePath = path.join(ARTIFACT_DIR, `${id}__${safe}`);

    const buf = Buffer.from(String(dataBase64), "base64");
    fs.writeFileSync(filePath, buf);
    const meta = { id, orgId, filename: safe, contentType, size: buf.length, createdAt: nowIso(), source: "ingestion-service" };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    return res.status(201).json({ evidence_id: id, status: "stored" });
  } catch (e) {
    console.error("[ingest] error", e);
    return res.status(500).json({ error: "ingest failed" });
  }
}

app.post("/api/ingest/documents", handleJsonIngest);
app.post("/api/ingestion/documents", handleJsonIngest);

const PORT = Number(process.env.PORT || 8000);
app.listen(PORT, () => {
  console.log("[ingestion-service] listening on", PORT, "ARTIFACT_DIR:", ARTIFACT_DIR);
});
export default app;
