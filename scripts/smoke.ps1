
Param(
  [string]$Base   = "http://localhost:8081",
  [string]$ApiKey = "ct2-dev-key"
)
$H = @{ "x-api-key" = $ApiKey; "Content-Type"="application/json" }

function Check($name, [scriptblock]$sb) {
  try { & $sb; Write-Host "√ $name" -ForegroundColor Green }
  catch {
    Write-Host "× $name" -ForegroundColor Red
    if ($_.Exception.Response) {
      Write-Host ("  Status: {0} {1}" -f $_.Exception.Response.StatusCode,
                                        $_.Exception.Response.StatusDescription) -ForegroundColor Red
    }
    Write-Host ("  Error: {0}" -f $_.Exception.Message) -ForegroundColor Red
    exit 1
  }
}

Check "Jobs health" {
  Invoke-RestMethod -Uri "$Base/api/jobs/health" -Headers $H -Method GET | Out-Null
}

Check "Seed two points" {
  $body = @{
    org_id = "demo"
    meter  = "grid_kwh"
    unit   = "kWh"
    points = @(
      @{ ts="2024-11-05T00:00:00Z"; value=118.0 },
      @{ ts="2024-11-06T00:00:00Z"; value=121.5 }
    )
  } | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Uri "$Base/api/time-series/points" -Headers $H -Method POST -Body $body | Out-Null
}

Check "Run demo job" {
  $payload = @{ org_id="demo"; period="2024Q4"; template="truststrip"; meter="grid_kwh"; unit="kWh" } | ConvertTo-Json
  $r = Invoke-RestMethod -Uri "$Base/api/jobs/run/demo" -Headers $H -Method POST -Body $payload
  if (-not $r.ok) { throw "jobs.run.demo did not return ok=true" }
}

Check "Compute KPI directly" {
  $payload = @{ org_id="demo"; period="2024Q4" } | ConvertTo-Json
  $r = Invoke-RestMethod -Uri "$Base/api/kpi/compute" -Headers $H -Method POST -Body $payload
  if (-not $r.ok) { throw "kpi.compute did not return ok=true" }
}

Write-Host "`nAll green! 🚀" -ForegroundColor Green
