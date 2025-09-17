import { Router, json } from "express";
import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";

const router = Router();
// allow smallish JSON
router.use(json({ limit: process.env.JSON_LIMIT || "5mb" }));

const BASE = "/api/evidence";
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/var/lib/ct2/artifacts";

// ensure artifact dir exists
(async () => { try { await fsp.mkdir(ARTIFACT_DIR, { recursive: true }); } catch {} })();

type Meta = {
  evidence_id: string;
  org_id?: string;
  filename?: string;
  contentType?: string;
  bytes?: number;
  created_at?: string;
  source?: string;
};

async function resolveArtifact(id: string): Promise<null | { meta: Meta; filePath: string; size: number }> {
  try {
    const metaPath = path.join(ARTIFACT_DIR, `${id}.json`);
    const metaRaw = await fsp.readFile(metaPath, "utf8");
    const meta = JSON.parse(metaRaw) as Meta;

    // find the file saved as "<id>__<filename>"
    const entries = await fsp.readdir(ARTIFACT_DIR);
    const fileName = entries.find(n => n.startsWith(`${id}__`));
    if (!fileName) return null;

    const filePath = path.join(ARTIFACT_DIR, fileName);
    const stat = await fsp.stat(filePath);
    return { meta, filePath, size: stat.size };
  } catch {
    return null;
  }
}

function setHeaders(res: any, meta: Meta, size: number) {
  res.setHeader("Content-Type", meta?.contentType || "application/octet-stream");
  res.setHeader("Content-Length", String(size));
  res.setHeader("Cache-Control", "no-store");
  const fname = meta?.filename || "artifact.bin";
  res.setHeader("Content-Disposition", `inline; filename="${fname}"`);
}

// health (root + namespaced to match Traefik router)
router.get("/health", (_req, res) => res.json({ ok: true }));
router.get("/ready",  (_req, res) => res.json({ ok: true }));
router.get(`${BASE}/health`, (_req, res) => res.json({ ok: true }));
router.get(`${BASE}/ready`,  (_req, res) => res.json({ ok: true }));

// HEAD/GET content — support both with and without StripPrefix
async function headHandler(req: any, res: any) {
  const id = String(req.params.id);
  const r = await resolveArtifact(id);
  if (!r) return res.status(404).json({ error: "not found" });
  setHeaders(res, r.meta, r.size);
  return res.status(200).end();
}
async function getHandler(req: any, res: any) {
  const id = String(req.params.id);
  const r = await resolveArtifact(id);
  if (!r) return res.status(404).json({ error: "not found" });
  setHeaders(res, r.meta, r.size);
  fs.createReadStream(r.filePath).pipe(res);
}

// When Traefik StripPrefix(`/api/evidence`) is active, upstream path is "/:id/content"
router.head("/:id/content", headHandler);
router.get("/:id/content", getHandler);

// Also expose the fully-qualified paths in case StripPrefix isn't applied
router.head(`${BASE}/:id/content`, headHandler);
router.get(`${BASE}/:id/content`, getHandler);

export default router;
