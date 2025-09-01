param(
  [switch]$Recreate,
  [int]$TimeoutSec = 45
)

$ErrorActionPreference = 'Stop'
$base  = "http://localhost:8081"
$admin = "http://localhost:8090"

function Hit($url, $timeout=5) {
  try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $resp = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec $timeout
    $sw.Stop()
    [pscustomobject]@{
      url  = $url
      code = [int]$resp.StatusCode
      ms   = $sw.ElapsedMilliseconds
      ok   = ($resp.StatusCode -eq 200)
    }
  } catch {
    [pscustomobject]@{ url=$url; code=0; ms=0; ok=$false }
  }
}

function NameFromPath($path) {
  if ($path -like "/docs/*") { return "docs" }
  if ($path -notlike "/api/*") { return $path.Trim('/') }
  $seg = ($path -split "/") | Where-Object { $_ } | Select-Object -Index 1
  switch ($seg) {
    "data-quality"     { "data-quality" }
    "emission-factors" { "emission-factors" }
    "time-series"      { "time-series" }
    default            { $seg }
  }
}

function WaitForRouters($need, $timeoutSec) {
  Write-Host "`n1) Routers check (waiting up to $timeoutSec s)" -ForegroundColor Cyan
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  do {
    try {
      $routers = (Invoke-RestMethod -Uri "$admin/api/http/routers" -TimeoutSec 3).name
    } catch {
      Start-Sleep 1
      continue
    }
    $miss = $need | Where-Object { $_ -notin $routers }
    if ($miss.Count -eq 0) {
      Write-Host "Routers OK: $($need -join ', ')" -ForegroundColor Green
      return $true
    }
    Start-Sleep 1
  } while ((Get-Date) -lt $deadline)
  Write-Host "Missing routers: $($miss -join ', ')" -ForegroundColor Red
  return $false
}

if ($Recreate) {
  Write-Host "Recreating full S1 stack..." -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File "D:\CT2\compose\up-s1.ps1" -Recreate | Out-Host
}

# 1) Wait until Traefik admin is reachable
Write-Host "`n0) Traefik admin readiness" -ForegroundColor Cyan
$deadline = (Get-Date).AddSeconds($TimeoutSec)
do {
  try { $null = Invoke-RestMethod -Uri "$admin/api/http/routers" -TimeoutSec 3; $ok=$true } catch { $ok=$false }
  if ($ok) { break }
  Start-Sleep 1
} while ((Get-Date) -lt $deadline)
if (-not $ok) { Write-Host "Traefik admin not reachable." -ForegroundColor Red; exit 1 }

# 2) Ensure the expected routers are present (with patience)
$needRouters = @(
  'reports@docker','evidence@docker','time-series@docker',
  'emission-factors@docker','webroot@docker','docs-reports@docker'
)
if (-not (WaitForRouters $needRouters $TimeoutSec)) { exit 2 }

# 3) Health wall
Write-Host "`n2) Health wall" -ForegroundColor Cyan
$paths = @(
  "/api/reports/health","/api/evidence/health",
  "/api/time-series/health","/api/emission-factors/health",
  "/api/esg/health","/api/data-quality/health","/api/jobs/health","/api/xbrl/health",
  "/api/kpi/health","/api/ingest/health","/api/dash/health","/api/search/health",
  "/docs/reports"
)
$results = $paths | ForEach-Object { Hit ($base+$_) }

$results |
  Select-Object @{n='name';e={ NameFromPath(($_.url -replace $base,'')) }}, ok, code, ms |
  Format-Table

if ($results.ok -contains $false) {
  Write-Host "`nOne or more health checks failed." -ForegroundColor Red
  exit 3
}

# 4) Build → status → evidence flip (org-aware)
Write-Host "`n3) Build → status → evidence flip" -ForegroundColor Cyan
$headers = @{ 'X-Org-Id' = 'demo' }
$payload = @{ template="truststrip"; period="2024Q4" } | ConvertTo-Json
try {
  $resp = Invoke-RestMethod -Method POST -Uri "$base/api/reports/build" -Headers $headers -Body $payload -ContentType "application/json"
} catch {
  Write-Host "POST /api/reports/build failed (if you see nginx 404, check router priorities)." -ForegroundColor Red
  throw
}
$id = $resp.artifactId
Write-Host ("artifactId={0}" -f $id)

$s = Invoke-RestMethod "$base/api/reports/status/$id"
if (-not $s.ok) { Write-Host "Status not OK" -ForegroundColor Red; exit 4 }

$r1 = Invoke-WebRequest -UseBasicParsing -Method HEAD -Uri "$base/api/evidence/artifacts/$id/content"
$ct1 = $r1.Headers["Content-Type"]; Write-Host "stub Content-Type: $ct1"
Start-Sleep 2
$r2 = Invoke-WebRequest -UseBasicParsing -Method HEAD -Uri "$base/api/evidence/artifacts/$id/content"
$ct2 = $r2.Headers["Content-Type"]; Write-Host "final Content-Type: $ct2"

if ($ct1 -notlike "text/*" -or $ct2 -ne "application/pdf") {
  Write-Host "Evidence flip failed ($ct1 -> $ct2)." -ForegroundColor Red
  exit 5
}

# S2 explicit route sanity
$r3 = Invoke-WebRequest -UseBasicParsing -Method HEAD -Uri "$base/api/evidence/orgs/demo/artifacts/$id/content"
if ($r3.StatusCode -ne 200) { Write-Host "S2 org route not 200" -ForegroundColor Yellow }

Write-Host "`nALL GOOD ✅" -ForegroundColor Green
