<#  Demo bootstrap (S1)
    - Brings the full demo stack up
    - Waits briefly, then runs the smoke test
    Usage:
      powershell -ExecutionPolicy Bypass -File .\compose\demo.ps1
      powershell -ExecutionPolicy Bypass -File .\compose\demo.ps1 -Recreate
      powershell -ExecutionPolicy Bypass -File .\compose\demo.ps1 -Build -Recreate
#>

[CmdletBinding()]
param(
  [switch]$Recreate,
  [switch]$Build
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:COMPOSE_PROJECT_NAME = "ct2"

$ComposeDir = $PSScriptRoot
$composeFiles = @(
  "docker-compose.yml",
  "docker-compose.traefik.yml",
  "docker-compose.mocks.stack.yml",
  "docker-compose.traefik.netfix.yml",
  "docker-compose.reports.router.yml",
  "docker-compose.evidence.router.yml",
  "docker-compose.artifacts.yml",
  "docker-compose.mocks.health-only.yml",
  "docker-compose.docs.yml",
  "docker-compose.landing.yml"
)

# Build argument list safely (avoid Invoke-Expression / string parsing issues)
$argList = @("compose","-p","ct2")
$composeFiles | ForEach-Object { $argList += @("-f", (Join-Path $ComposeDir $_)) }
$argList += @("up","-d")
if ($Recreate) { $argList += "--force-recreate" }
if ($Build)    { $argList += "--build" }

Write-Host "Running: docker $($argList -join ' ')" -ForegroundColor Cyan
& docker @argList

# Small readiness gate: wait for Traefik admin to answer
$admin = "http://localhost:8090"
$deadline = (Get-Date).AddSeconds(45)
$ready = $false
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest -Uri "$admin/api/http/routers?search=reports" -TimeoutSec 3 -UseBasicParsing
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch { Start-Sleep -Milliseconds 500 }
}
if (-not $ready) {
  Write-Warning "Traefik admin not ready yet; continuing..."
}

# If smoke-s1.ps1 exists, run it; otherwise do a tiny health wall
$smoke = Join-Path $ComposeDir "smoke-s1.ps1"
if (Test-Path $smoke) {
  Write-Host "`n--- Running smoke-s1.ps1 ---`n" -ForegroundColor Green
  & powershell -ExecutionPolicy Bypass -File $smoke
} else {
  Write-Host "`n--- Quick health wall ---`n" -ForegroundColor Green
  $base = "http://localhost:8081"
  $paths = @(
    "/api/reports/health","/api/evidence/health",
    "/api/time-series/health","/api/emission-factors/health",
    "/api/esg/health","/api/data-quality/health","/api/jobs/health","/api/xbrl/health",
    "/api/kpi/health","/api/ingest/health","/api/dash/health","/api/search/health"
  )
  foreach ($p in $paths) {
    try {
      $r = Invoke-WebRequest -Uri ($base+$p) -TimeoutSec 3 -UseBasicParsing
      "{0,-20} {1} {2}" -f $p, $r.StatusCode, $r.RawContentLength
    } catch {
      "{0,-20} ERR" -f $p
    }
  }
  Write-Host "`nTip: add compose\smoke-s1.ps1 for full build→status→evidence flip." -ForegroundColor DarkGray
}



<#  Demo teardown (S1)
    - Stops and removes the demo stack
    - Optionally removes the named volumes and stray networks
    Usage:
      powershell -ExecutionPolicy Bypass -File .\compose\down-s1.ps1
      powershell -ExecutionPolicy Bypass -File .\compose\down-s1.ps1 -PruneVolumes
#>

[CmdletBinding()]
param(
  [switch]$PruneVolumes
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:COMPOSE_PROJECT_NAME = "ct2"

$ComposeDir = $PSScriptRoot
$composeFiles = @(
  "docker-compose.yml",
  "docker-compose.traefik.yml",
  "docker-compose.mocks.stack.yml",
  "docker-compose.traefik.netfix.yml",
  "docker-compose.reports.router.yml",
  "docker-compose.evidence.router.yml",
  "docker-compose.artifacts.yml",
  "docker-compose.mocks.health-only.yml",
  "docker-compose.docs.yml",
  "docker-compose.landing.yml"
)

$argList = @("compose","-p","ct2")
$composeFiles | ForEach-Object { $argList += @("-f", (Join-Path $ComposeDir $_)) }
$argList += @("down","--remove-orphans")
if ($PruneVolumes) { $argList += "-v" }

Write-Host "Running: docker $($argList -join ' ')" -ForegroundColor Cyan
& docker @argList

# Clean up occasional stray networks created during experiments
$maybeNets = @("ct2_ct2_ct2-net","compose_ct2-net")
foreach ($n in $maybeNets) {
  try {
    $exists = docker network ls --format "{{.Name}}" | Where-Object { $_ -eq $n }
    if ($exists) {
      Write-Host "Removing stray network: $n" -ForegroundColor Yellow
      docker network rm $n | Out-Null
    }
  } catch { }
}

Write-Host "Done." -ForegroundColor Green
if ($PruneVolumes) { Write-Host "Named volumes removed (including ct2_artifacts)." -ForegroundColor DarkGray }



## Quickstart — One-Command Demo (S1)

**Prereqs**
- Docker Desktop (Windows) with WSL2 integration
- PowerShell
- Ports **8081** (public) and **8090** (Traefik admin) available

**Bring the stack up + verify**
```powershell
# From repo root (D:\CT2)
powershell -ExecutionPolicy Bypass -File .\compose\demo.ps1 -Recreate




This will:

Start Traefik + all demo services/mocks

Wait for the admin API

Run the smoke test (routers, health wall, and build → status → evidence (txt→pdf))

Open

Landing page: http://localhost:8081/

Reports API docs: http://localhost:8081/docs/reports

Traefik admin: http://localhost:8090/dashboard/

Evidence routes

S1 (back-compat): GET /api/evidence/artifacts/:artifactId/content

S2 (org-aware): GET /api/evidence/orgs/:org/artifacts/:artifactId/content
→ Build with optional header X-Org-Id: demo (defaults to demo)

Tear down

powershell -ExecutionPolicy Bypass -File .\compose\down-s1.ps1
# or nuke named volumes too:
powershell -ExecutionPolicy Bypass -File .\compose\down-s1.ps1 -PruneVolumes


Troubleshooting

If Traefik routers are missing, re-run:
powershell -ExecutionPolicy Bypass -File .\compose\smoke-s1.ps1 -Recreate

Ensure Traefik and all backends are on the same Docker network: ct2_ct2-net.

If you see nginx 404 HTML at /api/reports/*, the reports router isn’t active yet—wait a few seconds or recreate.


want me to also drop a tiny `docs\reports.openapi.yml` stub that matches the demo endpoints (so Swagger stays in sync)?
