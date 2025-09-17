import express from "express";
import fs from "fs";
import path from "path";
import mime from "mime";

const app = express();
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/var/lib/ct2/artifacts";
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

app.get("/api/evidence/health", (_req, res) => res.json({ ok: true }));
app.get("/health", (_req, res) => res.json({ ok: true }));

function findContentPath(id: string) {
  const prefix = `${id}__`;
  for (const f of fs.readdirSync(ARTIFACT_DIR)) {
    if (f.startsWith(prefix)) return path.join(ARTIFACT_DIR, f);
  }
  return null;
}
function readDeclaredType(id: string, fallback: string) {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(ARTIFACT_DIR, `${id}.json`), "utf-8"));
    return meta.contentType || fallback;
  } catch {
    return fallback;
  }
}

app.head("/api/evidence/:id/content", (req, res) => {
  const p = findContentPath(req.params.id);
  if (!p || !fs.existsSync(p)) return res.status(404).end();
  const stat = fs.statSync(p);
  const guessed = mime.getType(p) || "application/octet-stream";
  const ct = readDeclaredType(req.params.id, guessed);
  res.setHeader("Content-Type", ct);
  res.setHeader("Content-Length", String(stat.size));
  return res.status(200).end();
});

app.get("/api/evidence/:id/content", (req, res) => {
  const p = findContentPath(req.params.id);
  if (!p || !fs.existsSync(p)) return res.status(404).json({ error: "not found" });
  const guessed = mime.getType(p) || "application/octet-stream";
  const ct = readDeclaredType(req.params.id, guessed);
  res.setHeader("Content-Type", ct);
  return res.sendFile(p);
});

const PORT = Number(process.env.PORT || 8000);
app.listen(PORT, () => console.log("[evidence] listening on", PORT, "dir:", ARTIFACT_DIR));
export default app;
