<# 
  Stage-1 Health Wall + End-to-End Demo
  Usage:
    1) Save this file as D:\CT2\scripts\stage1_e2e.ps1 (or anywhere).
    2) Optionally edit the variables in the "Config" section below.
    3) From PowerShell:  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
                         .\stage1_e2e.ps1
#>

#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

# ---------------------------
# Config
# ---------------------------
$Base       = "http://localhost:8081"
$DevApiKey  = "dev-123"
$SampleDoc  = "D:\CT2\sample.pdf"   # put any small file here
$DownloadTo = "D:\CT2\out.bin"
$Period     = "2024Q4"
$Account    = "demo"

# ---------------------------
# Helpers
# ---------------------------
function Write-Section($title) {
  Write-Host ""
  Write-Host "=== $title ===" -ForegroundColor Cyan
}

function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][ValidateSet('GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS')]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter()][object]$Body = $null,
    [Parameter()][hashtable]$Headers = @{},
    [Parameter()][string]$ContentType = "application/json"
  )
  $uri = "$Base$Path"
  if ($null -ne $Body -and $ContentType -eq "application/json" -and -not ($Body -is [string])) {
    $Body = ($Body | ConvertTo-Json -Depth 100)
  }
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers -ContentType $ContentType -Body $Body -TimeoutSec 30
}

function Try-GetJson {
  param([string]$Uri)
  try {
    return Invoke-RestMethod -Uri $Uri -TimeoutSec 5 -ErrorAction Stop
  } catch {
    return $null
  }
}

function Health-Wall {
  $paths = @(
    "/api/reports/health","/api/esg/health","/api/ingest/health","/api/evidence/health",
    "/api/timeseries/health","/api/emission-factors/health","/api/data-quality/health",
    "/api/kpi/health","/api/xbrl/health","/api/search/health","/api/jobs/health","/api/dashboards/health"
  )
  Write-Section "Health Wall ($Base)"
  foreach ($p in $paths) {
    $resp = Try-GetJson "$Base$p"
    if ($null -ne $resp -and $resp.status -eq "ok") {
      Write-Host ("{0} -> ok" -f $p) -ForegroundColor Green
    } else {
      Write-Host ("{0} -> DOWN" -f $p) -ForegroundColor Red
    }
  }
}

function Wait-ForReport {
  param([string]$ArtifactId, [int]$TimeoutSec = 90)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  do {
    Start-Sleep -Seconds 2
    try {
      $st = Invoke-RestMethod -Uri "$Base/api/reports/status/$ArtifactId" -TimeoutSec 10 -ErrorAction Stop
      $state = $st.state
      if (-not $state) { $state = $st.status }
      if ($state -match 'ready|done|ok|completed') {
        return $st
      }
      Write-Host ("report status: {0}" -f ($state ? $state : "pending")) -ForegroundColor DarkGray
    } catch {
      Write-Host "status check failed (retrying)..." -ForegroundColor DarkGray
    }
  } while ((Get-Date) -lt $deadline)
  throw "Report $ArtifactId did not reach ready state within $TimeoutSec seconds."
}

# ---------------------------
# 0) Initial Health
# ---------------------------
Health-Wall

# ---------------------------
# 1) Ingestion round-trip (dev key)
# ---------------------------
Write-Section "Ingestion → Evidence round-trip"
if (-not (Test-Path $SampleDoc)) {
  # create a tiny sample file if missing
  "[demo] CogTechAI sample $(Get-Date -Format s)" | Set-Content -Encoding UTF8 -Path $SampleDoc
}
$headers = @{ "x-api-key" = $DevApiKey }

# PowerShell multipart upload via Invoke-WebRequest
$form = @{ file = Get-Item $SampleDoc }
$uploadContent = (Invoke-WebRequest -Uri "$Base/api/ingest/documents" -Method Post -Form $form -Headers $headers -TimeoutSec 60).Content
$upload = $uploadContent | ConvertFrom-Json
$jobId = $upload.jobId
$sha   = $upload.sha256
Write-Host ("Uploaded. jobId={0} sha256={1}" -f $jobId,$sha) -ForegroundColor Green

# fetch evidence blob by sha
Invoke-WebRequest -Uri "$Base/api/evidence/blob/$sha" -OutFile $DownloadTo -TimeoutSec 60 | Out-Null
Write-Host ("Evidence saved to {0} ({1} bytes)" -f $DownloadTo, (Get-Item $DownloadTo).Length) -ForegroundColor Green

# ---------------------------
# 2) Seed emission factors
# ---------------------------
Write-Section "Seed Emission Factors (demo)"
$seed = @(
  @{ key="grid.in.kwh_to_co2e"; value=0.82; unit="kgCO2e/kWh" },
  @{ key="diesel.l_to_co2e";   value=2.68; unit="kgCO2e/L" }
)
$seedResp = Invoke-Api -Method POST -Path "/api/emission-factors/seed" -Body $seed
$seedResp | Out-Host

# ---------------------------
# 3) Time-series points
# ---------------------------
Write-Section "Write & Query Time-Series"
$points = @(
  @{ metric="scope2.co2e"; period=$Period; account=$Account; value=102500 },
  @{ metric="energy.kwh";  period=$Period; account=$Account; value=125000 }
)
Invoke-Api -Method POST -Path "/api/timeseries/points" -Body $points | Out-Null
$ts = Invoke-Api -Method GET -Path "/api/timeseries/query?metric=scope2.co2e&period=$Period&account=$Account"
$ts | Out-Host

# ---------------------------
# 4) Data Quality rules + heatmap
# ---------------------------
Write-Section "Data Quality → Heatmap"
$rules = @(
  @{ metric="scope2.co2e"; rule="required" },
  @{ metric="energy.kwh";  rule="required" }
)
Invoke-Api -Method POST -Path "/api/data-quality/rules" -Body $rules | Out-Null
$dq = Invoke-Api -Method GET -Path "/api/data-quality/heatmap?period=$Period&account=$Account"
$dq | Out-Host

# ---------------------------
# 5) KPI values
# ---------------------------
Write-Section "KPI Calculation"
# example inputs; adjust to your demo math
$kpi = Invoke-Api -Method GET -Path "/api/kpi/values?scope2=102500&area=50000&revenue=25000000"
$kpi | Out-Host

# ---------------------------
# 6) Build report → wait → xBRL checks
# ---------------------------
Write-Section "Build Report → Status → xBRL Coverage & Validation"
$req = @{ template="truststrip"; period=$Period; account=$Account }
$job = Invoke-Api -Method POST -Path "/api/reports/build" -Body $req
$artifactId = $job.artifactId
if (-not $artifactId) { throw "No artifactId returned from /api/reports/build" }
Write-Host ("Report build started. artifactId={0}" -f $artifactId) -ForegroundColor Yellow

$status = Wait-ForReport -ArtifactId $artifactId -TimeoutSec 120
$status | Out-Host

$cov = Invoke-Api -Method GET -Path "/api/xbrl/coverage?period=$Period&account=$Account"
$val = Invoke-Api -Method GET -Path "/api/xbrl/validation-log?artifactId=$artifactId"
Write-Host "Coverage:" -ForegroundColor Cyan
$cov | Out-Host
Write-Host "Validation Log:" -ForegroundColor Cyan
$val | Out-Host

# ---------------------------
# 7) Landing + Search sanity
# ---------------------------
Write-Section "Landing + Search"
$landing = Invoke-Api -Method GET -Path "/api/dashboards/landing"
$search  = Invoke-Api -Method GET -Path "/api/search?q=truststrip"
$landing | Out-Host
$search  | Out-Host

# ---------------------------
# 8) Final Health
# ---------------------------
Health-Wall

Write-Host "`nDone. Stage-1 demo completed." -ForegroundColor Green
