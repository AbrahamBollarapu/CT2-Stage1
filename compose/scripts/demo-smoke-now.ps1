$Admin = "http://localhost:8090"
$Base  = "http://localhost:8085"
$H = @{ "x-api-key"="ct2-dev-key"; "Content-Type"="application/json" }

# Admin up
Invoke-RestMethod "$Admin/api/version" | Out-Null
Write-Host "√ Traefik admin reachable at $Admin" -ForegroundColor Green

# Routers present & enabled
$routers = Invoke-RestMethod "$Admin/api/http/routers"
$want = @("api-suppliers@file","api-time-series@file")
$found = @($routers | Where-Object { $_.name -in $want })
"Routers:"
$found | ForEach-Object { "{0,-22} {1,-34} {2,-8} {3}" -f $_.name,$_.rule,$_.status,$_.service }
$missing = $want | Where-Object { $_ -notin ($found | ForEach-Object name) }
if ($missing) { throw "Missing routers: $($missing -join ', ')" }
if ($found | Where-Object status -ne 'enabled') { throw "Routers not enabled" }
Write-Host "√ Routers present & enabled." -ForegroundColor Green

# Suppliers
$rows = Invoke-RestMethod "$Base/api/suppliers?org_id=test-org" -Headers $H -Method GET
Write-Host "√ suppliers GET returned $($rows.Count) row(s)" -ForegroundColor Green

# Time-series
Invoke-RestMethod "$Base/api/time-series/health" | Out-Null
Write-Host "√ time-series /health OK" -ForegroundColor Green

$body = @{
  org_id = "test-org"
  meter  = "demo.meter.1"
  unit   = "kWh"
  points = @(@{ ts = [DateTime]::UtcNow.ToString("o"); metric = "demo.kwh"; value = 1.23 })
} | ConvertTo-Json -Depth 5

$result = Invoke-RestMethod -Method Post "$Base/api/time-series/points" -Headers $H -Body $body
Write-Host "√ time-series ingest: ok=$($result.ok) size=$($result.series_size)" -ForegroundColor Green
