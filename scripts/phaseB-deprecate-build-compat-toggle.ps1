# Toggleable compat logging + optional Sunset header
$ErrorActionPreference='Stop'
$RepoRoot='D:/CT2'
$RepSrc = Join-Path $RepoRoot 'apps/backend/services/report-compiler-service/src'

$updated = @'
import type { Express, Request, Response } from "express";
declare const fetch: any;

type JobStatus = "queued" | "running" | "completed" | "failed";
const JOBS_URL = process.env.JOBS_SERVICE_URL || "http://jobs-service:8000";
const COMPAT_LOG = process.env.REPORTS_COMPAT_LOG !== "0"; // default on
const COMPAT_SUNSET = process.env.REPORTS_COMPAT_SUNSET || "";

function genId(prefix: string){ return `${prefix}_${Date.now()}`; }

async function postJson(url: string, payload: any) {
  try {
    await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  } catch {}
}

async function handleBuild(req: Request, res: Response, note?: string) {
  const body = (req.body || {}) as any;
  const account  = (req.query.account as string)  || body.account  || "demo";
  const period   = (req.query.period as string)   || body.period   || "2024Q4";
  const template = (req.query.template as string) || body.template || "demo";
  const title    = (body.title as string) || "Demo Report";

  const artifactId = genId("rep");
  const jobId      = genId("job");

  await postJson(`${JOBS_URL}/create`, { jobId, kind: "report-build", status: "queued", meta: { account, period, template, artifactId, title } });
  res.status(202).json({ ok: true, jobId, artifactId, status: "queued", note });
  setTimeout(async () => { await postJson(`${JOBS_URL}/update`, { jobId, status: "completed" as JobStatus }); }, 600);
}

export function registerReportsApi(app: Express) {
  app.post("/build", async (req, res) => handleBuild(req, res));

  app.post("/build-compat", async (req, res) => {
    const q = req.query, b = (req.body || {}) as any;
    const account  = (q.account as string)  || b.account  || "demo";
    const period   = (q.period as string)   || b.period   || "2024Q4";
    const template = (q.template as string) || b.template || "demo";
    const ip = (req.headers["x-forwarded-for"] as string) || (req.socket && req.socket.remoteAddress) || "";
    const ua = (req.headers["user-agent"] as string) || "";

    if (COMPAT_LOG) {
      console.warn(JSON.stringify({
        level: "warn", service: "report-compiler-service", event: "deprecation",
        route: "/api/reports/build-compat",
        msg: "Deprecated endpoint called; use POST /api/reports/build",
        account, period, template, ip, ua, time: new Date().toISOString()
      }));
    }

    res.setHeader("Warning", '299 - "Deprecated API: use POST /api/reports/build"');
    res.setHeader("Deprecation", "true");
    res.setHeader("Link", '</api/reports/build>; rel="successor-version"');
    if (COMPAT_SUNSET) res.setHeader("Sunset", COMPAT_SUNSET);

    return handleBuild(req, res, "DEPRECATED: use POST /build");
  });
}
'@

[IO.File]::WriteAllText((Join-Path $RepSrc 'reports-api.ts'), $updated, (New-Object Text.UTF8Encoding($false)))
Write-Host "Compat logging toggle + Sunset header added." -ForegroundColor Green
