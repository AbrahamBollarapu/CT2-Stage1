<# 
CogTechAI – 5-minute demo script
Prereqs: DNS demo.yourdomain.com → server IP; ports 80/443 open; stack up with prod overlay.
#>

$ErrorActionPreference = "Stop"
$base = "https://demo.yourdomain.com"

function Step($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }

# 1) Health checks
Step "Health checks"
Invoke-RestMethod "$base/health" | Out-Host
Invoke-RestMethod "$base/api/kpi/health" | Out-Host
Invoke-RestMethod "$base/api/time-series/health" | Out-Host

# 2) Simulate ingest (choose the available path)
Step "Simulate device ingest"
$payload = @{
  org_id = "test-org"
  metric = "grid_kwh"
  value  = Get-Random -Min 50 -Max 120
  ts     = (Get-Date).ToUniversalTime().ToString("o")
}

try {
  # Preferred: edge-gateway
  Invoke-RestMethod "$base/api/edge/ingest" -Method POST -Body ($payload | ConvertTo-Json) -ContentType "application/json" | Out-Host
} catch {
  Write-Host "edge-gateway ingest failed, trying time-series/write…" -ForegroundColor Yellow
  Invoke-RestMethod "$base/api/time-series/write" -Method POST -Body ($payload | ConvertTo-Json) -ContentType "application/json" | Out-Host
}

# 3) Read KPIs
Step "Read KPIs"
$kpi = Invoke-RestMethod "$base/api/kpi?org_id=test-org"
$kpi | ConvertTo-Json -Depth 5 | Write-Output

# 4) Open dashboard
Step "Open dashboard"
Start-Process "$base"
