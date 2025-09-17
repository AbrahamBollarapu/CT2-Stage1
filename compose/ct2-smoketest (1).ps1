Param(
  [string]$Base = "http://localhost:8081",
  [string]$ApiKey = "ct2-dev-key",
  [string]$OrgId = "demo"
)
$ErrorActionPreference = 'Stop'

function Print-Header($txt) { Write-Host "`n=== $txt ===" -ForegroundColor Cyan }

$headers = @{ "x-api-key" = $ApiKey }

# Time-series health → write → read
Print-Header "Time Series"
$tsHealth = Invoke-RestMethod "$Base/api/time-series/health"
$body = @{
  org_id=$OrgId; meter="grid_kwh"; unit="kWh"; from="2024-10-01"; to="2024-12-31";
  points=@(@{ts="2024-11-05T00:00:00Z"; value=118.0}, @{ts="2024-12-05T00:00:00Z"; value=121.3})
} | ConvertTo-Json -Depth 6
$tsWrite = Invoke-RestMethod -Headers $headers -Method Post "$Base/api/time-series/points?mode=replace" -ContentType 'application/json' -Body $body
$tsRead  = (Invoke-WebRequest "$Base/api/time-series/points?org_id=$OrgId&meter=grid_kwh&unit=kWh&from=2024-10-01&to=2024-12-31" -UseBasicParsing).Content | ConvertFrom-Json

# ESG / DQ / KPI
Print-Header "ESG / DQ / KPI"
$b = @{org_id=$OrgId; meter="grid_kwh"; unit="kWh"; from="2024-10-01"; to="2024-12-31"} | ConvertTo-Json
$esg = (Invoke-WebRequest -Method Post "$Base/api/esg/footprint"       -ContentType 'application/json' -Body $b -UseBasicParsing).StatusCode
$dq  = (Invoke-WebRequest -Method Post "$Base/api/data-quality/checks" -ContentType 'application/json' -Body $b -UseBasicParsing).StatusCode
$kpi = (Invoke-WebRequest         "$Base/api/kpi/energy?org_id=$OrgId&meter=grid_kwh&unit=kWh&from=2024-10-01&to=2024-12-31" -UseBasicParsing).StatusCode

# Reports build → poll → download
Print-Header "Reports"
$job = Invoke-RestMethod -Method Post "$Base/api/reports/build" -ContentType 'application/json' -Body (@{ org_id=$OrgId; template="default"; period="2024-Q4" } | ConvertTo-Json)
do { Start-Sleep 2; $status = Invoke-RestMethod "$Base/api/reports/status/$($job.job_id)" } while ($status.state -in @("queued","running"))
$aid = $status.artifact_id
$outDir = "D:\CT2\out"; if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Force $outDir | Out-Null }
$outZip = Join-Path $outDir "report-2024-Q4.zip"
Invoke-WebRequest "$Base/api/reports/artifacts/$aid" -OutFile $outZip -UseBasicParsing | Out-Null

# XBRL coverage
Print-Header "XBRL / TrustStrip"
$x = Invoke-RestMethod "$Base/api/xbrl/coverage?org_id=$OrgId&period=2024-Q4"

# Summary table
Print-Header "Summary"
$table = [PSCustomObject]@{
  TS_Health = $tsHealth.ok
  TS_Written = $tsWrite.ok
  TS_Points = ($tsRead.points | Measure-Object).Count
  ESG = $esg
  DQ  = $dq
  KPI = $kpi
  ReportState = $status.state
  ArtifactId  = $aid
  ArtifactZip = $outZip
  CoverageOk  = $x.ok
}
$table | Format-List
