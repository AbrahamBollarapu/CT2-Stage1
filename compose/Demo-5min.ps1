$ErrorActionPreference = "Stop"
$base = "https://demo.yourdomain.com"
Write-Host "1) Health checks" -ForegroundColor Cyan
Invoke-RestMethod "$base/health"
Invoke-RestMethod "$base/api/kpi/health"
Invoke-RestMethod "$base/api/time-series/health"

Write-Host "2) Simulate device ingest" -ForegroundColor Cyan
$ingest = @{ org_id="test-org"; metric="grid_kwh"; value= (Get-Random -Min 50 -Max 120) }
Invoke-RestMethod "$base/api/edge/ingest" -Method POST -Body ($ingest | ConvertTo-Json) -ContentType "application/json"

Write-Host "3) Read KPIs" -ForegroundColor Cyan
$kpi = Invoke-RestMethod "$base/api/kpi?org_id=test-org"
$kpi | ConvertTo-Json -Depth 5 | Write-Output

Write-Host "4) Open dashboard" -ForegroundColor Cyan
Start-Process "$base"
