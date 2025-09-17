Param(
  [string]$Base = "http://localhost:8081",
  [string]$ApiKey = "ct2-dev-key",
  [string]$Org = "demo",
  [string]$Period = "2024Q4",
  [int]$MaxPoll = 20,
  [int]$PollDelaySec = 2
)

$ErrorActionPreference = "Stop"
$Headers = @{
  "x-api-key" = $ApiKey
  "x-org-id"  = $Org
}

function Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "[ OK ] $msg" -ForegroundColor Green }
function Err($msg)  { Write-Host "[ERR ] $msg" -ForegroundColor Red }

try {
  Info "Health checks"
  @( "/api/esg/health", "/api/data-quality/health", "/api/reports/health" ) | ForEach-Object {
    $u = "$Base$_"
    $r = Invoke-WebRequest -Method GET -Uri $u -Headers $Headers -UseBasicParsing
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) { Ok "Healthy: $_" } else { throw "Unhealthy: $_" }
  }

  Info "Ingest: time-series points (alias acceptable)"
  $points = @(
    @{ ts="2024-11-05T00:00:00Z"; value=118.0 },
    @{ ts="2024-11-06T00:00:00Z"; value=121.4 }
  )
  $body = @{
    org_id = $Org
    meter  = "grid_kwh"
    unit   = "kWh"
    from   = "2024-10-01"
    to     = "2024-12-31"
    points = $points
  } | ConvertTo-Json -Depth 5
  $r = Invoke-RestMethod -Method POST -Uri "$Base/api/time-series/points" -Headers ($Headers + @{ "Content-Type"="application/json" }) -Body $body
  Ok "Ingested points: $($points.Count)"

  Info "ESG compute"
  $r = Invoke-RestMethod -Method POST -Uri "$Base/api/esg/compute" -Headers ($Headers + @{ "Content-Type"="application/json" }) -Body (@{ account="demo"; period=$Period } | ConvertTo-Json)
  Ok "ESG compute ok"

  Info "DQ evaluate"
  $r = Invoke-RestMethod -Method POST -Uri "$Base/api/data-quality/evaluate" -Headers ($Headers + @{ "Content-Type"="application/json" }) -Body (@{ account="demo"; period=$Period } | ConvertTo-Json)
  Ok "DQ evaluate ok"

  Info "Reports build"
  $build = Invoke-RestMethod -Method POST -Uri "$Base/api/reports/build" -Headers ($Headers + @{ "Content-Type"="application/json" }) -Body (@{ template="truststrip"; period=$Period } | ConvertTo-Json)
  $artifactId = $build.artifactId
  if (-not $artifactId) { throw "No artifactId returned" }
  Ok "Queued report: $artifactId"

  Info "Polling report status"
  $status = "queued"
  for ($i=0; $i -lt $MaxPoll; $i++) {
    Start-Sleep -Seconds $PollDelaySec
    $s = Invoke-RestMethod -Method GET -Uri "$Base/api/reports/status/$artifactId" -Headers $Headers
    $status = $s.status
    Write-Host "  poll#$i -> $status"
    if ($status -eq "completed") { break }
    if ($status -eq "failed") { throw "Report failed" }
  }
  if ($status -ne "completed") { throw "Report not completed in time" }
  Ok "Report completed"

  Info "Downloading artifact"
  $outDir = Join-Path $PSScriptRoot "artifacts"
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $outFile = Join-Path $outDir "$artifactId.pdf"
  Invoke-WebRequest -Method GET -Uri "$Base/api/reports/artifacts/$artifactId" -Headers $Headers -OutFile $outFile -UseBasicParsing
  Ok "Saved report: $outFile"

  Info "Evidence HEAD/GET"
  $ev = "$Base/api/evidence/demo-evidence/content"
  $h = Invoke-WebRequest -Method HEAD -Uri $ev -Headers $Headers -UseBasicParsing
  if (-not $h.Headers."Content-Type") { throw "Missing Content-Type" }
  if (-not $h.Headers."Content-Length") { throw "Missing Content-Length" }
  $eout = Join-Path $outDir "demo-evidence.bin"
  Invoke-WebRequest -Method GET -Uri $ev -Headers $Headers -OutFile $eout -UseBasicParsing
  Ok "Downloaded evidence: $eout"

  Ok "SMOKE PASS"
  exit 0
}
catch {
  Err "$_"
  exit 1
}
