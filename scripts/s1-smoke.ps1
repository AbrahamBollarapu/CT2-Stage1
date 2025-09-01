# D:\CT2\scripts\s1-smoke.ps1
param(
  [string]$Base    = "http://localhost:8081",
  [string]$Account = "demo",
  [string]$Period  = "2024Q4",
  [string]$Template = "demo",
  [int]$PollTries = 8,
  [int]$PollDelayMs = 400
)

$ErrorActionPreference = 'Stop'
function J($o){ ($o | ConvertTo-Json -Depth 8) }
function Ok($msg){ Write-Host $msg -ForegroundColor Green }
function Warn($msg){ Write-Host $msg -ForegroundColor Yellow }
function Fail($msg){ Write-Host $msg -ForegroundColor Red }

$sw = [Diagnostics.Stopwatch]::StartNew()
$allOk = $true

# 1) Compute chain
try {
  $payload = @{ account=$Account; period=$Period } | ConvertTo-Json
  Invoke-RestMethod -Method POST -Uri "$Base/api/esg/compute"           -Body $payload -ContentType "application/json" | Out-Null
  Invoke-RestMethod -Method POST -Uri "$Base/api/data-quality/evaluate" -Body $payload -ContentType "application/json" | Out-Null
  $kpi = Invoke-RestMethod -Method POST -Uri "$Base/api/kpi/recompute"  -Body $payload -ContentType "application/json"
  $kpiList = Invoke-RestMethod -Uri "$Base/api/kpi/list?account=$Account&period=$Period"
  Ok "[compute] ESG→DQ→KPI OK"
} catch {
  $allOk = $false; Fail "[compute] FAILED: $($_.Exception.Message)"
}

# 2) Reports build (canonical, with compat fallback)
$jobId = $null; $artifactId = $null; $buildSource = "canonical"
try {
  $resp = Invoke-RestMethod -Method POST -Uri "$Base/api/reports/build?account=$Account&period=$Period&template=$Template" `
          -Body (@{ title = "Demo Report" } | ConvertTo-Json) -ContentType "application/json"
  $jobId = $resp.jobId
  $artifactId = $resp.artifactId
  if (-not $jobId) { throw "canonical returned no jobId" }
  Ok "[build] canonical queued jobId=$jobId artifactId=$artifactId"
} catch {
  Warn "[build] canonical failed ($($_.Exception.Message)); trying compat…"
  try {
    $cres = Invoke-RestMethod -Method POST -Uri "$Base/api/reports/build-compat?account=$Account&period=$Period&template=$Template" `
           -Body (@{ title = "Demo Report" } | ConvertTo-Json) -ContentType "application/json"
    $artifactId = $cres.artifactId
    $buildSource = "compat"
    if ($artifactId) { Ok "[build] compat OK artifactId=$artifactId" } else { throw "compat returned no artifactId" }
  } catch {
    $allOk = $false; Fail "[build] BOTH canonical and compat failed: $($_.Exception.Message)"
  }
}

# 3) If canonical path, poll job status
$finalStatus = $null
if ($jobId) {
  for ($i=0; $i -lt $PollTries; $i++) {
    Start-Sleep -Milliseconds $PollDelayMs
    try {
      $st = Invoke-RestMethod -Uri "$Base/api/jobs/status/$jobId"
      $finalStatus = $st.status
      if ($st.status -eq 'completed') { Ok "[jobs] $jobId completed"; break }
      if ($st.status -eq 'failed')    { $allOk = $false; Fail "[jobs] $jobId failed"; break }
      if ($i -eq 0) { Write-Host "[jobs] waiting…" -ForegroundColor DarkGray }
    } catch {
      $allOk = $false; Fail "[jobs] status check error: $($_.Exception.Message)"; break
    }
  }
  if (-not $finalStatus) { $allOk = $false; Fail "[jobs] no status received" }
  elseif ($finalStatus -ne 'completed') { $allOk = $false; Fail "[jobs] not completed (status=$finalStatus)" }
} else {
  Warn "[jobs] skipping poll (compat path or no jobId)"
}

# 4) XBRL coverage
try {
  $cov = Invoke-RestMethod -Uri "$Base/api/xbrl/coverage?period=$Period&account=$Account"
  Ok "[xbrl] coverage OK"
} catch {
  $allOk = $false; Fail "[xbrl] coverage FAILED: $($_.Exception.Message)"
}

$sw.Stop()
$summary = @{
  ok         = $allOk
  ms         = $sw.ElapsedMilliseconds
  account    = $Account
  period     = $Period
  build      = $buildSource
  jobId      = $jobId
  artifactId = $artifactId
  jobStatus  = $finalStatus
}
Write-Host ""
if ($allOk) { Ok ("S1 SMOKE: OK " + (J $summary)) } else { Fail ("S1 SMOKE: FAIL " + (J $summary)) }
