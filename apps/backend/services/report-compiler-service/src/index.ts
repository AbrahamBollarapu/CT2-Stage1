import express, { Request, Response } from "express";
import path from "node:path";
import fs from "node:fs/promises";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8000);
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "/var/lib/ct2/artifacts";
const ORG_DEFAULT = process.env.ORG_DEFAULT || "demo";
const JSON_LIMIT = process.env.JSON_LIMIT || "8mb";

type BuildInput = {
  title?: string;
  params?: Record<string, any>;
};

type Meta = {
  evidence_id: string;
  org_id: string;
  filename: string;
  contentType: string;
  bytes: number;
  created_at: string;
  source: string;
  title?: string;
  params?: Record<string, any>;
};

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getOrgId(req: Request): string {
  const h = (req.headers["x-org-id"] || req.headers["x-orgid"] || "") as string;
  const q = (req.query.org || req.query.org_id || "") as string;
  const v = (h || q || "").toString().trim();
  return v || ORG_DEFAULT;
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function writeArtifact(org: string, title: string, params: Record<string, any>) {
  const evidence_id = uuidv4();
  const filename = "report.pdf";

  // IMPORTANT: Save in ARTIFACT_DIR ROOT (no org subdir) to match evidence-store lookup
  await ensureDir(ARTIFACT_DIR);
  const base = path.join(ARTIFACT_DIR, evidence_id);

  // Tiny placeholder bytes. Replace with real PDF generation later.
  const lines = [
    "CT2 Demo Report",
    `Title: ${title}`,
    `Org: ${org}`,
    `Generated: ${new Date().toISOString()}`,
    `Params: ${JSON.stringify(params)}`
  ].join("\n");
  const payload = Buffer.from(lines, "utf8");

  const meta: Meta = {
    evidence_id,
    org_id: org,
    filename,
    contentType: "application/pdf",
    bytes: payload.length,
    created_at: new Date().toISOString(),
    source: "report-compiler-service",
    title,
    params
  };

  await fs.writeFile(`${base}__${filename}`, payload);
  await fs.writeFile(`${base}.json`, JSON.stringify(meta, null, 2));

  return { evidence_id };
}

function mountCommon(app: express.Express) {
  app.use(express.json({ limit: JSON_LIMIT }));

  // best-effort optional middlewares
  try {
    // @ts-ignore
    const { requestIdMiddleware } = require("./request-id");
    if (requestIdMiddleware) app.use(requestIdMiddleware);
  } catch {}
  try {
    // @ts-ignore
    const { httpLogger } = require("./http-logger");
    if (httpLogger) app.use(httpLogger);
  } catch {}
  try {
    // @ts-ignore
    const { registerOpenApi } = require("./openapi");
    if (registerOpenApi && typeof registerOpenApi === "function") {
      registerOpenApi(app, "report-compiler-service");
    }
  } catch {}
}

function registerRoutes(app: express.Express) {
  const BASE = "/api/reports";

  // health
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/ready",  (_req, res) => res.json({ ok: true }));
  app.get(`${BASE}/health`, (_req, res) => res.json({ ok: true }));
  app.get(`${BASE}/ready`,  (_req, res) => res.json({ ok: true }));

  // coverage stub
  const coverage = (_req: Request, res: Response) => res.json({
    ok: true,
    xbrl_mapping: { available: true },
    sections: ["executive_summary", "kpi_snapshot", "dq_heatmap"]
  });
  app.get("/coverage", coverage);
  app.get(`${BASE}/coverage`, coverage);

  // build -> evidence flip
  const build = async (req: Request, res: Response) => {
    try {
      const org = getOrgId(req);
      const body = (req.body || {}) as BuildInput;
      const title = (body.title || "MVP Demo Report").toString();
      const params = body.params || {};
      const out = await writeArtifact(org, title, params);
      console.log("[report-compiler] built", { org, evidence_id: out.evidence_id });
      res.status(201).json({ evidence_id: out.evidence_id, status: "built" });
    } catch (e: any) {
      console.error("[report-compiler] build_error", e);
      res.status(500).json({ error: e?.message || "build failed" });
    }
  };
  // Support BOTH shapes (with and without StripPrefix)
  app.post("/build", build);
  app.post(`${BASE}/build`, build);
}

async function main() {
  await ensureDir(ARTIFACT_DIR);
  const app = express();
  mountCommon(app);
  registerRoutes(app);
  console.log("[reports] ARTIFACT_DIR ready:", ARTIFACT_DIR);
  console.log("[reports] listening on", PORT, "(routes: /build and /api/reports/build)");
  app.listen(PORT, HOST);
}

main().catch((e) => {
  console.error("fatal", e);
  process.exit(1);
});
