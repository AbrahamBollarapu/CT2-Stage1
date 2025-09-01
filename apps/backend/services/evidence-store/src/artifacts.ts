// src/artifacts.ts
import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import mime from "mime-types";

const router = express.Router();

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/var/lib/ct2/artifacts";
const ALLOWED_EXT = [".pdf", ".zip", ".xbrl", ".xml", ".json", ".txt"];

function resolveArtifactPath(id: string): string | null {
  const safeId = id.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeId || safeId.includes("..")) return null;

  // Try common extensions; first match wins
  for (const ext of ALLOWED_EXT) {
    const p = path.join(ARTIFACT_DIR, `${safeId}${ext}`);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  // Fallback: exact filename match if the job wrote the full filename already
  const exact = path.join(ARTIFACT_DIR, safeId);
  if (fs.existsSync(exact) && fs.statSync(exact).isFile()) return exact;

  // Last resort: scan for files that start with id + "."
  const files = fs.readdirSync(ARTIFACT_DIR).filter(f => f.startsWith(`${safeId}.`));
  if (files.length > 0) return path.join(ARTIFACT_DIR, files[0]);

  return null;
}

function setHeaders(res: Response, filePath: string) {
  const filename = path.basename(filePath);
  const ctype = mime.lookup(filePath) || "application/octet-stream";
  res.setHeader("Content-Type", ctype);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Artifact-Filename", filename);
}

router.head("/artifacts/:id/content", (req: Request, res: Response) => {
  const p = resolveArtifactPath(req.params.id);
  if (!p) return res.status(404).json({ ok: false, error: "artifact_not_found" });
  setHeaders(res, p);
  res.status(200).end();
});

router.get("/artifacts/:id/content", (req: Request, res: Response) => {
  const p = resolveArtifactPath(req.params.id);
  if (!p) return res.status(404).json({ ok: false, error: "artifact_not_found" });

  try {
    setHeaders(res, p);
    const stat = fs.statSync(p);
    res.setHeader("Content-Length", stat.size.toString());
    fs.createReadStream(p).pipe(res);
  } catch (e) {
    res.status(500).json({ ok: false, error: "artifact_stream_error" });
  }
});

export default router;
