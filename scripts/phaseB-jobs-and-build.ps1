# ================== Phase B — Jobs + Reports APIs (PS 5.1-safe) ==================
$ErrorActionPreference = 'Stop'

$RepoRoot = "D:/CT2"
$Backend  = Join-Path $RepoRoot "apps/backend"

function Write-Utf8NoBom($Path, $Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}
function Ensure-Dir($p){ if(-not(Test-Path $p)){ New-Item -ItemType Directory -Path $p | Out-Null } }

# ----------------- B1) jobs-service: add simple job store API -----------------
$jobsSvcDir = Join-Path $Backend "services/jobs-service"
$jobsSrcDir = Join-Path $jobsSvcDir "src"
Ensure-Dir $jobsSrcDir

$jobsApi = @'
import type { Express, Request, Response } from "express";

// In-memory job store for Stage-1
type JobStatus = "queued" | "running" | "completed" | "failed";
interface Job {
  jobId: string;
  kind: string;
  status: JobStatus;
  meta?: Record<string, any>;
  error?: string;
  updatedAt: number;
}
const jobStore: Map<string, Job> = new Map();

function now(){ return Date.now(); }
function upsert(job: Job){ job.updatedAt = now(); jobStore.set(job.jobId, job); }

export function registerJobsApi(app: Express) {
  // Create job
  app.post("/create", (req: Request, res: Response) => {
    const body = (req.body || {}) as Partial<Job>;
    const jobId = String(body.jobId || `job_${Date.now()}`);
    const job: Job = {
      jobId,
      kind: String(body.kind || "generic"),
      status: (body.status as JobStatus) || "queued",
      meta: body.meta || {},
      updatedAt: now(),
    };
    upsert(job);
    return res.status(202).json({ ok: true, jobId, status: job.status });
  });

  // Update job
  app.post("/update", (req: Request, res: Response) => {
    const body = (req.body || {}) as Partial<Job>;
    if (!body.jobId) return res.status(400).json({ ok:false, error:"jobId required" });
    const existing = jobStore.get(String(body.jobId));
    if (!existing) return res.status(404).json({ ok:false, error:"job not found" });
    if (body.status) existing.status = body.status as JobStatus;
    if (typeof body.error === "string") existing.error = body.error;
    if (body.meta) existing.meta = { ...(existing.meta||{}), ...(body.meta||{}) };
    upsert(existing);
    return res.json({ ok:true, jobId: existing.jobId, status: existing.status });
  });

  // Get job status
  app.get("/status/:id", (_req: Request, res: Response) => {
    const id = String(_req.params.id);
    const job = jobStore.get(id);
    if (!job) return res.status(404).json({ ok:false, status: "not_found" });
    return res.json({ ok:true, jobId: job.jobId, status: job.status, error: job.error, meta: job.meta, updatedAt: job.updatedAt });
  });
}
'@
Write-Utf8NoBom (Join-Path $jobsSrcDir "jobs-api.ts") $jobsApi

# Inject into jobs-service/src/index.ts
$jobsIndex = Join-Path $jobsSrcDir "index.ts"
if (-not (Test-Path $jobsIndex)) { Write-Error "Missing $jobsIndex - adjust paths if your entry is different."; exit 1 }

$content = Get-Content -Raw $jobsIndex
if ($content -notmatch "import\s*\{\s*registerJobsApi\s*\}\s*from\s*'./jobs-api'") {
  $content = "import { registerJobsApi } from './jobs-api';`r`n" + $content
}
# ensure body parser
if ($content -notmatch "app\.use\(\s*express\.json\(\)\s*\)") {
  $content = $content -replace "const\s+app\s*=\s*express\(\)\s*;", "const app = express();`r`napp.use(express.json());"
}
# register API after app creation (simple append if not present)
if ($content -notmatch "registerJobsApi\s*\(") {
  $content = $content + "`r`nregisterJobsApi(app);`r`n"
}
Write-Utf8NoBom $jobsIndex $content

# ----------------- B2) report-compiler-service: canonical /build (+ compat) ---
$repSvcDir = Join-Path $Backend "services/report-compiler-service"
$repSrcDir = Join-Path $repSvcDir "src"
if (-not (Test-Path $repSrcDir)) { Write-Error "Missing $repSrcDir - adjust paths if your layout is different."; exit 1 }

$reportsApi = @'
import type { Express, Request, Response } from "express";
declare const fetch: any; // avoid TS lib issues for Stage-1

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

  // Compat (deprecated)
  app.post("/build-compat", async (req, res) => handleBuild(req, res, "DEPRECATED: use POST /build"));
}
'@
Write-Utf8NoBom (Join-Path $repSrcDir "reports-api.ts") $reportsApi

# Inject into report-compiler-service/src/index.ts
$repIndex = Join-Path $repSrcDir "index.ts"
if (-not (Test-Path $repIndex)) { Write-Error "Missing $repIndex - adjust paths if your entry is different."; exit 1 }

$rcontent = Get-Content -Raw $repIndex
if ($rcontent -notmatch "import\s*\{\s*registerReportsApi\s*\}\s*from\s*'./reports-api'") {
  $rcontent = "import { registerReportsApi } from './reports-api';`r`n" + $rcontent
}
# ensure body parser
if ($rcontent -notmatch "app\.use\(\s*express\.json\(\)\s*\)") {
  $rcontent = $rcontent -replace "const\s+app\s*=\s*express\(\)\s*;", "const app = express();`r`napp.use(express.json());"
}
# register API after app creation (simple append if not present)
if ($rcontent -notmatch "registerReportsApi\s*\(") {
  $rcontent = $rcontent + "`r`nregisterReportsApi(app);`r`n"
}
Write-Utf8NoBom $repIndex $rcontent

Write-Host "Phase B patch complete: jobs-service + report-compiler-service updated." -ForegroundColor Green
