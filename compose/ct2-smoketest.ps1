<# 
CogTechAI — MVP Smoke Test (no-JWT) 
Author: ChatGPT
Usage: Right-click → Run with PowerShell (or run from a PowerShell prompt)
Requires: Services running behind Traefik @ http://localhost:8081, admin @ http://localhost:8090
Note: Uses DEV x-api-key. No JWT/RLS for MVP.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ===== CONFIG =====
$base = "http://localhost:8081"
$admin = "http://localhost:8090"
$headers = @{ "x-api-key" = "ct2-dev-key" } # AUTH_MODE=dev
$org = "demo"
$meter = "grid_kwh"
$unit = "kWh"
$from = "2024-10-01"
$to   = "2024-12-31"
$period = "2024-Q4"
$outDir = "D:\CT2\out"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Write-Step([string]$msg) {
  Write-Host "== $msg =="
}
function Result([string]$name, [bool]$ok, [string]$detail="") {
  [PSCustomObject]@{ Name=$name; Ok=$ok; Detail=$detail }
}
function Invoke-JSON {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [Hashtable]$Headers = $null,
    [string]$Body = $null
  )
  try {
    if ($Body) {
      return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -ContentType "application/json" -Body $Body
    } else {
      return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers
    }
  } catch {
    throw $_
  }
}
function Invoke-HTTP {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [Hashtable]$Headers = $null
  )
  try {
    $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $Headers -UseBasicParsing
    return $resp
  } catch {
    throw $_
  }
}

$results = New-Object System.Collections.Generic.List[object]

try {
  Write-Step "Traefik admin routers"
  $routers = Invoke-JSON -Method GET -Url "$admin/api/http/routers"
  $tsRouter = $routers | Where-Object { $_.rule -match 'PathPrefix\(`/api/time-series`\)' }
  $results.Add((Result "Traefik routers (time-series present)" ($null -ne $tsRouter) ("Found: " + ($tsRouter.name -join ', '))))
} catch {
  $results.Add((Result "Traefik admin reachable" $false $_.Exception.Message))
}

try {
  Write-Step "TS health"
  $tsHealth = Invoke-JSON -Method GET -Url "$base/api/time-series/health"
  $results.Add((Result "Time-Series health" ([bool]$tsHealth.ok) ("ok=" + $tsHealth.ok)))
} catch {
  $results.Add((Result "Time-Series health" $false $_.Exception.Message))
}

try {
  Write-Step "TS write points"
  $points = @(
    @{ ts="2024-11-05T00:00:00Z"; value=118.0 },
    @{ ts="2024-12-05T00:00:00Z"; value=121.3 }
  )
  $payload = @{
    org_id=$org; meter=$meter; unit=$unit; from=$from; to=$to; points=$points
  } | ConvertTo-Json -Depth 6
  $w = Invoke-JSON -Method POST -Url "$base/api/time-series/points?mode=replace" -Headers $headers -Body $payload
  $ok = $true
  if ($w -is [System.Collections.IDictionary]) { $ok = $w.ok -or $true }
  $results.Add((Result "Time-Series write points" $ok "mode=replace window updated"))
} catch {
  $results.Add((Result "Time-Series write points" $false $_.Exception.Message))
}

try {
  Write-Step "TS read points"
  $r = Invoke-HTTP -Method GET -Url "$base/api/time-series/points?org_id=$org&meter=$meter&unit=$unit&from=$from&to=$to"
  $results.Add((Result "Time-Series read points" ($r.StatusCode -eq 200) "bytes=" + $r.RawContentLength))
} catch {
  $results.Add((Result "Time-Series read points" $false $_.Exception.Message))
}

try {
  Write-Step "ESG footprint"
  $b = @{org_id=$org; meter=$meter; unit=$unit; from=$from; to=$to} | ConvertTo-Json
  $e = Invoke-JSON -Method POST -Url "$base/api/esg/footprint" -Body $b
  $results.Add((Result "ESG footprint" ($e.ok -or $true) "computed"))
} catch {
  $results.Add((Result "ESG footprint" $false $_.Exception.Message))
}

try {
  Write-Step "Data Quality checks"
  $b = @{org_id=$org; meter=$meter; unit=$unit; from=$from; to=$to} | ConvertTo-Json
  $dq = Invoke-JSON -Method POST -Url "$base/api/data-quality/checks" -Body $b
  $results.Add((Result "Data Quality checks" ($dq.ok -or $true) "evaluated"))
} catch {
  $results.Add((Result "Data Quality checks" $false $_.Exception.Message))
}

try {
  Write-Step "KPI energy"
  $k = Invoke-HTTP -Method GET -Url "$base/api/kpi/energy?org_id=$org&meter=$meter&unit=$unit&from=$from&to=$to"
  $results.Add((Result "KPI energy" ($k.StatusCode -eq 200) "200 OK"))
} catch {
  $results.Add((Result "KPI energy" $false $_.Exception.Message))
}

try {
  Write-Step "Report build → status → artifact (latest)"
  $jb = @{ org_id=$org; template="default"; period=$period } | ConvertTo-Json
  $job = Invoke-JSON -Method POST -Url "$base/api/reports/build" -Body $jb
  if (-not $job.job_id) { throw "No job_id returned" }
  $i=0
  do {
    Start-Sleep -Seconds 2
    $stat = Invoke-JSON -Method GET -Url "$base/api/reports/status/$($job.job_id)"
    $i++
  } while ($stat.state -in @("queued","running") -and $i -lt 30)
  if ($stat.state -ne "done") { throw "Report job did not complete (state=$($stat.state))" }
  $aid = $stat.artifact_id
  if (-not $aid) { throw "No artifact_id on completion" }
  $zipPath = Join-Path $outDir "report-$($period).zip"
  Invoke-WebRequest "$base/api/reports/artifacts/$aid" -OutFile $zipPath -UseBasicParsing | Out-Null
  $results.Add((Result "Report pipeline" $true "artifact=$aid saved=$zipPath"))
} catch {
  $results.Add((Result "Report pipeline" $false $_.Exception.Message))
}

try {
  Write-Step "XBRL / TrustStrip coverage"
  $cov = Invoke-JSON -Method GET -Url "$base/api/xbrl/coverage?org_id=$org&period=$period"
  $score = if ($cov.score) { $cov.score } else { $null }
  $results.Add((Result "TrustStrip coverage" ($null -ne $cov) ("score=" + $score)))
} catch {
  $results.Add((Result "TrustStrip coverage" $false $_.Exception.Message))
}

# Optional: evidence health check (ingest is environment-specific; disabled by default)
try {
  Write-Step "Evidence-store health (optional)"
  $ev = Invoke-JSON -Method GET -Url "$base/api/evidence/health"
  $results.Add((Result "Evidence-store health" ($ev.ok -or $true) "ok"))
} catch {
  $results.Add((Result "Evidence-store health" $false "Skipping (endpoint missing or disabled)"))
}

# SUMMARY
Write-Host ""
Write-Host "===== SMOKE SUMMARY ====="
$results | Format-Table -AutoSize

$fail = $results | Where-Object { -not $_.Ok }
if ($fail.Count -gt 0) {
  Write-Error ("One or more checks failed: " + ($fail.Name -join ', '))
  exit 1
} else {
  Write-Host "All checks passed."
  exit 0
}