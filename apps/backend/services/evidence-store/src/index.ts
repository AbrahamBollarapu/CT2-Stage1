import express, { Request, Response } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { constants as fsconst, existsSync } from "node:fs";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8000);
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/var/lib/ct2/artifacts";
const ORG_DEFAULT = process.env.ORG_DEFAULT || "demo";

function getOrgId(req: Request): string | undefined {
  const h = (req.headers["x-org-id"] || req.headers["x-orgid"] || "") as string;
  const q = (req.query.org || req.query.org_id || "") as string;
  const v = (h || q || "").toString().trim();
  return v || undefined;
}

function candidatePath(org: string, id: string, ext: string) {
  return path.join(ARTIFACT_DIR, org, `${id}.${ext}`);
}

async function listOrgDirs(): Promise<string[]> {
  try {
    const ents = await fs.readdir(ARTIFACT_DIR, { withFileTypes: true });
    return ents.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function firstExisting(filepaths: string[]): Promise<string | undefined> {
  for (const p of filepaths) {
    try {
      await fs.access(p, fsconst.R_OK);
      return p;
    } catch {
      /* continue */
    }
  }
  return undefined;
}

function inferMime(p: string): { mime: string; filename: string } {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".pdf") return { mime: "application/pdf", filename: path.basename(p) };
  if (ext === ".zip") return { mime: "application/zip", filename: path.basename(p) };
  return { mime: "text/plain", filename: path.basename(p) };
}

async function resolveArtifactPath(req: Request, id: string): Promise<string | undefined> {
  // 1) If org provided (header or query), try that first
  const orgHint = getOrgId(req);

  if (orgHint) {
    const p = await firstExisting([
      candidatePath(orgHint, id, "pdf"),
      candidatePath(orgHint, id, "zip"),
      candidatePath(orgHint, id, "txt"),
    ]);
    if (p) return p;
  }

  // 2) Try default org
  const pDefault = await firstExisting([
    candidatePath(ORG_DEFAULT, id, "pdf"),
    candidatePath(ORG_DEFAULT, id, "zip"),
    candidatePath(ORG_DEFAULT, id, "txt"),
  ]);
  if (pDefault) return pDefault;

  // 3) Probe all org directories (backward compatible / auto-discovery)
  const dirs = await listOrgDirs();
  for (const org of dirs) {
    const p = await firstExisting([
      candidatePath(org, id, "pdf"),
      candidatePath(org, id, "zip"),
      candidatePath(org, id, "txt"),
    ]);
    if (p) return p;
  }

  return undefined;
}

function mountRoutes(app: express.Express) {
  app.get("/health", (_req, res) => res.json({ status: "healthy" }));

  // Explicit org-aware route (S2-style)
  app.get("/orgs/:orgId/artifacts/:id/content", async (req: Request, res: Response) => {
    const { orgId, id } = req.params;
    const found = await firstExisting([
      candidatePath(orgId, id, "pdf"),
      candidatePath(orgId, id, "zip"),
      candidatePath(orgId, id, "txt"),
    ]);
    if (!found) return res.status(404).json({ ok: false, error: "not_found" });
    const { mime, filename } = inferMime(found);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.sendFile(found);
  });

  // Backward-compatible route (S1), now org-aware via header/query/search
  app.get("/artifacts/:id/content", async (req: Request, res: Response) => {
    const { id } = req.params;
    const found = await resolveArtifactPath(req, id);
    if (!found) {
      console.warn("[evidence] artifact_not_found", { id, dir: ARTIFACT_DIR });
      return res.status(404).json({ ok: false, error: "not_found" });
    }
    const { mime, filename } = inferMime(found);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.sendFile(found);
  });
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const app = express();
  mountRoutes(app);
  console.log("[evidence] ARTIFACT_DIR ready:", ARTIFACT_DIR);
  console.log("[evidence] listening on %d, artifacts at %s", PORT, ARTIFACT_DIR);
  app.listen(PORT, HOST);
}

main().catch((e) => {
  console.error("fatal", e);
  process.exit(1);
});
