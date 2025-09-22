param(
  [string]$Base = "http://localhost:8081",
  [string]$Org  = "test-org",
  [string]$Meter = "throughput",
  [string]$Unit  = "count",
  [int]$Hours = 48,
  [int]$MinVal = 8,
  [int]$MaxVal = 22
)

$H = @{ "x-api-key"="ct2-dev-key"; "Content-Type"="application/json" }
Write-Host "Seeding $Hours hours of '$Meter' for org '$Org'..." -ForegroundColor Cyan

$now = Get-Date
$pts = @()
for ($i = $Hours; $i -ge 0; $i--) {
  $ts = $now.AddHours(-$i).ToUniversalTime().ToString("o")
  $val = Get-Random -Minimum $MinVal -Maximum $MaxVal
  $pts += @{ ts = $ts; value = $val }
}

$body = @{
  org_id = $Org
  meter  = $Meter
  unit   = $Unit
  points = $pts
} | ConvertTo-Json -Depth 5

# Write points
$response = Invoke-RestMethod -Method Post -Uri "$Base/api/time-series/points" -Headers $H -Body $body
$response | ConvertTo-Json -Depth 5 | Write-Output

# Read-back last 2 days
$from = $now.AddDays(-2).ToUniversalTime().ToString("o")
$to   = $now.ToUniversalTime().ToString("o")
$read = Invoke-RestMethod "$Base/api/time-series/points?org_id=$Org&meter=$Meter&unit=$Unit&from=$from&to=$to" -Headers @{ "x-api-key"="ct2-dev-key" }

# PS5-safe "null coalesce"
if ($null -ne $read -and $read.PSObject.Properties['items']) {
  $count = @($read.items).Count
} else {
  $count = @($read).Count
}

Write-Host ("{0} points in last 48h" -f $count) -ForegroundColor Green
