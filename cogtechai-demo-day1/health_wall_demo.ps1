Param(
  [string]$Base = "http://localhost:8081"
)

$paths = @(
  "/api/jobs/health",
  "/api/evidence/health",
  "/api/time-series/health",
  "/api/emission-factors/health"
)

Write-Host "== CogTechAI Demo Day-1 Health Check ==" -ForegroundColor Cyan
foreach ($p in $paths) {
  try {
    $url = "$Base$p"
    $resp = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -TimeoutSec 5
    if ($resp.StatusCode -eq 200) {
      Write-Host "[OK] $url" -ForegroundColor Green
    } else {
      Write-Host "[WARN] $url  code=$($resp.StatusCode)" -ForegroundColor Yellow
    }
  } catch {
    Write-Host "[FAIL] $url  $_" -ForegroundColor Red
  }
}