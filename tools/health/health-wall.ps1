param(
  [string]$Base = "http://localhost:8081",
  [string]$Admin = "http://localhost:8090",
  [int]$TimeoutSec = 4
)

$ErrorActionPreference = "Stop"

function Test-Url {
  param(
    [Parameter(Mandatory)] [string]$Name,
    [Parameter(Mandatory)] [string]$Url,
    [switch]$Head
  )

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $ok = $false; $code = 0

  try {
    if ($Head) {
      $resp = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec $TimeoutSec
      $code = [int]$resp.StatusCode
      $ok = ($code -ge 200 -and $code -lt 400)
    } else {
      # If it returns JSON, this succeeds; if not, we still count a 200 status as OK.
      $null = Invoke-RestMethod -Uri $Url -TimeoutSec $TimeoutSec
      $ok = $true
      $code = 200
    }
  } catch {
    $r = $_.Exception.Response
    if ($r -and $r.StatusCode) { $code = [int]$r.StatusCode } else { $code = 0 }
    $ok = $false
  } finally {
    $sw.Stop()
  }

  [pscustomobject]@{
    name = $Name
    url  = $Url
    ok   = $ok
    code = $code
    ms   = [int]$sw.Elapsed.TotalMilliseconds
  }
}

# Give Traefik a heartbeat (in practice everything is already up for you)
Start-Sleep -Milliseconds 150

$checks = @(
  @{ name="reports"          ; url="$Base/api/reports/health" }
  @{ name="evidence"         ; url="$Base/api/evidence/health" }
  @{ name="time-series"      ; url="$Base/api/time-series/health" }
  @{ name="emission-factors" ; url="$Base/api/emission-factors/health" }
  @{ name="esg"              ; url="$Base/api/esg/health" }
  @{ name="data-quality"     ; url="$Base/api/data-quality/health" }
  @{ name="jobs"             ; url="$Base/api/jobs/health" }
  @{ name="xbrl"             ; url="$Base/api/xbrl/health" }
  @{ name="kpi"              ; url="$Base/api/kpi/health" }
  @{ name="ingest"           ; url="$Base/api/ingest/health" }
  @{ name="dashboards"       ; url="$Base/api/dash/health" }
  @{ name="search"           ; url="$Base/api/search/health" }
  @{ name="docs"             ; url="$Base/docs/reports" ; head=$true }
)

$results = foreach ($c in $checks) {
  Test-Url -Name $c.name -Url $c.url -Head:([bool]$c.head)
}

# Router presence (no ternary; keep PS5.1-safe)
$routerOk  = $false
$routerCode = 0
try {
  $routers = Invoke-RestMethod -Uri "$Admin/api/http/routers" -TimeoutSec $TimeoutSec
  $need = @("reports@docker","evidence@docker","time-series@docker","emission-factors@docker","webroot@docker","docs-reports@docker")
  $have = @($routers | Where-Object { $need -contains $_.name }).Count
  if ($have -eq $need.Count) { $routerOk = $true }
  $routerCode = 200
} catch {
  $routerOk = $false
  $routerCode = 0
}

$results += [pscustomobject]@{
  name = "routers"; url = "$Admin/api/http/routers"; ok = $routerOk; code = $routerCode; ms = 0
}

$results | Sort-Object name | Format-Table name, ok, code, ms -AutoSize

$fail = $results | Where-Object { -not $_.ok }
if ($fail) {
  Write-Host "`nOne or more checks failed:" -ForegroundColor Red
  $fail | Format-Table name, url, code, ms -AutoSize
  exit 1
} else {
  Write-Host "`nALL GREEN." -ForegroundColor Green
}
