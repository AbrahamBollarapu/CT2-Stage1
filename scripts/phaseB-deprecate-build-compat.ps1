# === Add deprecation logging & headers to /build-compat (PS 5.1-safe) ===
$ErrorActionPreference = 'Stop'
$RepoRoot = 'D:/CT2'
$RepSrc   = Join-Path $RepoRoot 'apps/backend/services/report-compiler-service/src'

function Write-Utf8NoBom([string]$Path,[string]$Text){
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path,$Text,$enc)
}

$reportsApi = @'
import type { Express, Request, Response } from "express";
declare const fetch: any; // stage-1 simplicity

type JobStatus = "queued" | "running" | "completed" | "failed";
const JOBS_URL = process.env.JOBS_SERVICE_URL || "http://jobs-service:8000";

function genId(prefix: string){ return `${prefix}_${Date.now()}`; }

async function postJson(url: string, payload: any) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {/* swallow for Stage-1 */}
}

async function handleBuild(req: Request, res: Response, note?: string) {
  const body = (req.body || {}) as any;
  const account  = (req.query.account as string)  || body.account  || "demo";
  const period   = (req.query.period as string)   || body.period   || "2024Q4";
  const template = (req.query.template as string) || body.template || "demo";
  const title    = (body.title as string) || "Demo Report";

  const artifactId = genId("rep");
  const jobId      = genId("job");

  // mark queued
  await postJson(`${JOBS_URL}/create`, { jobId, kind: "report-build", status: "queued", meta: { account, period, template, artifactId, title } });

  // respond immediately
  res.status(202).json({ ok: true, jobId, artifactId, status: "queued", note });

  // simulate small async compile, then complete
  setTimeout(async () => {
    await postJson(`${JOBS_URL}/update`, { jobId, status: "completed" as JobStatus });
  }, 600);
}

export function registerReportsApi(app: Express) {
  // Canonical
  app.post("/build", async (req, res) => handleBuild(req, res));

  // Compat (deprecated) — emit warning + headers, still call the same builder
  app.post("/build-compat", async (req, res) => {
    const q = req.query, b = (req.body || {}) as any;
    const account  = (q.account as string)  || b.account  || "demo";
    const period   = (q.period as string)   || b.period   || "2024Q4";
    const template = (q.template as string) || b.template || "demo";
    const ip = (req.headers["x-forwarded-for"] as string) || (req.socket && req.socket.remoteAddress) || "";
    const ua = (req.headers["user-agent"] as string) || "";

    // Structured warn to container logs
    console.warn(JSON.stringify({
      level: "warn",
      service: "report-compiler-service",
      event: "deprecation",
      route: "/api/reports/build-compat",
      msg: "Deprecated endpoint called; use POST /api/reports/build",
      account, period, template, ip, ua, time: new Date().toISOString()
    }));

    // Helpful response headers (non-fatal if clients ignore)
    res.setHeader("Warning", '299 - "Deprecated API: use POST /api/reports/build"');
    res.setHeader("Deprecation", "true");
    res.setHeader("Link", '</api/reports/build>; rel="successor-version"');

    return handleBuild(req, res, "DEPRECATED: use POST /build");
  });
}
'@

Write-Utf8NoBom (Join-Path $RepSrc 'reports-api.ts') $reportsApi
Write-Host "Patched reports-api.ts with deprecation logging." -ForegroundColor Green
