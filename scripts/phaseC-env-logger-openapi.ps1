# Stage-1 C1–C3: env example + compose env overlay + request correlation + openapi stubs
# PS 5.1-safe
$ErrorActionPreference = 'Stop'

$RepoRoot   = 'D:/CT2'
$ComposeDir = Join-Path $RepoRoot 'compose'
$Backend    = Join-Path $RepoRoot 'apps/backend'
$Services   = @(
  'ingestion-service','evidence-store',
  'esg-service','time-series-service','emission-factors-service','data-quality-service',
  'kpi-calculation-service','report-compiler-service','xbrl-mapping-service',
  'dashboards-service','search-index-service','jobs-service'
)

function Write-Utf8NoBom([string]$Path,[string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

# ---------------- C1: .env.local.example ----------------
$envExample = @'
# Common
NODE_ENV=development
LOG_LEVEL=info
PORT=8000

# Jobs / Reports
JOBS_SERVICE_URL=http://jobs-service:8000
REPORTS_COMPAT_LOG=1
# REPORTS_COMPAT_SUNSET=Mon, 30 Sep 2025 00:00:00 GMT

# Ingestion / Evidence
INGEST_API_KEY=changeme
EVIDENCE_ROOT=/data

# Search (if used)
SEARCH_INDEX_URL=http://search-index-service:8000

# Demo defaults
DEMO_ACCOUNT=demo
DEMO_PERIOD=2024Q4
'@
Write-Utf8NoBom (Join-Path $RepoRoot '.env.local.example') $envExample

# Compose env overlay (per-service env passthrough) — build as an array of lines
$outEnv = Join-Path $ComposeDir 'docker-compose.env.yml'
$lines = @()
$lines += 'services:'
foreach ($svc in $Services) {
  $lines += ("  {0}:" -f $svc)
  $lines += '    environment:'
  $lines += ("      SERVICE_NAME: ""{0}""" -f $svc)
  $lines += '      PORT: `${PORT:-8000}`'
  $lines += '      LOG_LEVEL: `${LOG_LEVEL:-info}`'
  if ($svc -eq 'report-compiler-service') {
    $lines += '      JOBS_SERVICE_URL: `${JOBS_SERVICE_URL:-http://jobs-service:8000}`'
    $lines += '      REPORTS_COMPAT_LOG: `${REPORTS_COMPAT_LOG:-1}`'
    $lines += '      REPORTS_COMPAT_SUNSET: `${REPORTS_COMPAT_SUNSET:-}`'
  }
  if ($svc -eq 'ingestion-service') {
    $lines += '      INGEST_API_KEY: `${INGEST_API_KEY:-changeme}`'
    $lines += '      SEARCH_INDEX_URL: `${SEARCH_INDEX_URL:-http://search-index-service:8000}`'
  }
  if ($svc -eq 'evidence-store') {
    $lines += '      EVIDENCE_ROOT: `${EVIDENCE_ROOT:-/data}`'
  }
}
$yaml = ($lines -join "`r`n")
Write-Utf8NoBom $outEnv $yaml

# ---------------- C2: request correlation + structured logging ----------------
$loggerTs = @'
export type LogLevel = "debug" | "info" | "warn" | "error";
const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minName = (process.env.LOG_LEVEL || "info").toLowerCase() as LogLevel;
const min = LEVELS[minName] ?? 20;
const service = process.env.SERVICE_NAME || (process as any).env?.npm_package_name || "service";

function emit(level: LogLevel, msg: string, fields: Record<string, any> = {}) {
  const rec: any = { level, time: new Date().toISOString(), service, msg, ...fields };
  try { console.log(JSON.stringify(rec)); } catch { /* ignore */ }
}

export const log = {
  debug: (msg: string, f?: Record<string, any>) => { if (min <= 10) emit("debug", msg, f); },
  info:  (msg: string, f?: Record<string, any>) => { if (min <= 20) emit("info",  msg, f); },
  warn:  (msg: string, f?: Record<string, any>) => { if (min <= 30) emit("warn",  msg, f); },
  error: (msg: string, f?: Record<string, any>) => emit("error", msg, f),
};
'@

$requestIdTs = @'
import type { Request, Response, NextFunction } from "express";
function genId() { return "req_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const hdr = (req.headers["x-request-id"] as string) || "";
  const id = hdr && typeof hdr === "string" ? hdr : genId();
  (req as any).reqId = id;
  res.setHeader("x-request-id", id);
  next();
}
'@

$httpLoggerTs = @'
import type { Request, Response, NextFunction } from "express";
import { log } from "./logger";
export function httpLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const id = (req as any).reqId || "";
  res.on("finish", () => {
    log.info("http", {
      reqId: id,
      method: req.method,
      path: (req as any).originalUrl || req.url,
      status: res.statusCode,
      ms: Date.now() - start
    });
  });
  next();
}
'@

# ---------------- C3: openapi stub ----------------
$openapiTs = @'
import type { Express, Request, Response } from "express";
export function registerOpenApi(app: Express, serviceName?: string) {
  const name = serviceName || process.env.SERVICE_NAME || (process as any).env?.npm_package_name || "service";
  app.get("/openapi.json", (_req: Request, res: Response) => {
    const doc = {
      openapi: "3.0.0",
      info: { title: name, version: "0.1.0" },
      paths: {
        "/health": { get: { summary: "Liveness", responses: { "200": { description: "OK" } } } },
        "/ready":  { get: { summary: "Readiness", responses: { "200": { description: "OK" } } } }
      },
      "x-service": name
    };
    res.json(doc);
  });
}
'@

function Patch-Service([string]$svc) {
  $svcDir = Join-Path $Backend ("services/{0}" -f $svc)
  $srcDir = Join-Path $svcDir 'src'
  if (-not (Test-Path $srcDir)) { Write-Warning ("[skip] {0} has no src dir" -f $svc); return }

  # Write helper files
  Write-Utf8NoBom (Join-Path $srcDir 'logger.ts')      $loggerTs
  Write-Utf8NoBom (Join-Path $srcDir 'request-id.ts')  $requestIdTs
  Write-Utf8NoBom (Join-Path $srcDir 'http-logger.ts') $httpLoggerTs
  Write-Utf8NoBom (Join-Path $srcDir 'openapi.ts')     $openapiTs

  # Patch index.ts: add imports; ensure body parser; inject middlewares + openapi after app creation
  $idx = Join-Path $srcDir 'index.ts'
  if (-not (Test-Path $idx)) { Write-Warning ("[skip] {0} missing index.ts" -f $svc); return }
  $raw = Get-Content -Raw $idx

  if ($raw -notmatch "import\s*\{\s*requestIdMiddleware\s*\}\s*from\s*'./request-id'") {
    $raw = "import { requestIdMiddleware } from './request-id';`r`n" + $raw
  }
  if ($raw -notmatch "import\s*\{\s*httpLogger\s*\}\s*from\s*'./http-logger'") {
    $raw = "import { httpLogger } from './http-logger';`r`n" + $raw
  }
  if ($raw -notmatch "import\s*\{\s*registerOpenApi\s*\}\s*from\s*'./openapi'") {
    $raw = "import { registerOpenApi } from './openapi';`r`n" + $raw
  }
  if ($raw -notmatch "app\.use\(\s*express\.json\(\)\s*\)") {
    $raw = $raw -replace "const\s+app\s*=\s*express\(\)\s*;", "const app = express();`r`napp.use(express.json());"
  }

  # Split to lines and insert after app creation
  $lines = $raw -split "`r?`n"
  $hasReqId = ($raw -match "app\.use\(\s*requestIdMiddleware\s*\)")
  $hasHttp  = ($raw -match "app\.use\(\s*httpLogger\s*\)")
  $hasOA    = ($raw -match "registerOpenApi\(\s*app\s*\)")

  if (-not ($hasReqId -and $hasHttp -and $hasOA)) {
    $inject = @()
    if (-not $hasReqId) { $inject += "app.use(requestIdMiddleware);" }
    if (-not $hasHttp)  { $inject += "app.use(httpLogger);" }
    if (-not $hasOA)    { $inject += "registerOpenApi(app);" }

    $inserted = $false
    for ($i=0; $i -lt $lines.Count; $i++) {
      if ($lines[$i] -match "const\s+app\s*=\s*express\(") {
        $before = $lines[0..$i]
        $after  = $lines[($i+1)..($lines.Count-1)]
        $lines  = $before + $inject + $after
        $inserted = $true
        break
      }
    }
    if (-not $inserted) {
      $lines = @("const app = express();","app.use(express.json());") + $inject + $lines
    }
  }

  $newContent = ($lines -join "`r`n")
  Write-Utf8NoBom $idx $newContent
  Write-Host ("[patched] {0} -> correlation + openapi" -f $svc) -ForegroundColor Cyan
}

foreach ($s in $Services) { Patch-Service $s }

Write-Host ''
Write-Host 'C1–C3 patch complete:' -ForegroundColor Green
Write-Host ' - .env.local.example written' -ForegroundColor Green
Write-Host ' - compose overlay: compose/docker-compose.env.yml' -ForegroundColor Green
Write-Host ' - request correlation + http logs + /openapi.json added to all services' -ForegroundColor Green
