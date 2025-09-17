param(
  [string]$Admin = "http://localhost:8090",
  [string]$Base  = "http://localhost:8081",
  [string]$OrgA  = "demo",
  [string]$OrgB  = "acme",
  [int]$AdminReadyTimeoutSec = 45,
  [int]$PollMs = 500,
  [int]$FlipTimeoutSec = 40,
  [int]$TraefikTail = 120
)

function Write-Stage($msg){ Write-Host "`n$msg" -ForegroundColor Cyan }
function Write-Ok($msg){ Write-Host $msg -ForegroundColor Green }
function Write-Warn($msg){ Write-Host $msg -ForegroundColor Yellow }
function Write-Err($msg){ Write-Host $msg -ForegroundColor Red }

function Wait-Until($ScriptBlock, [int]$TimeoutSec = 30, [int]$IntervalMs = 500){
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec){
    try {
      if (& $ScriptBlock){ return $true }
    } catch { }
    Start-Sleep -Milliseconds $IntervalMs
  }
  return $false
}

function Get-Head($url){
  $raw = curl.exe -s -I $url
  $code = ($raw | Select-String -Pattern '^HTTP/.*\s(\d{3})' -AllMatches).Matches | Select-Object -Last 1 |
          ForEach-Object { $_.Groups[1].Value }
  $ct = ($raw | Select-String -Pattern '^Content-Type:\s*(.+)$' -CaseSensitive:$false |
         Select-Object -Last 1 | ForEach-Object { $_.Matches[0].Groups[1].Value.Trim() })
  [PSCustomObject]@{ Code = [int]$code; ContentType = $ct; Raw = $raw -join "`n" }
}

function Wait-ForPdf($url, [int]$TimeoutSec, [int]$IntervalMs){
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $last = $null
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec){
    $h = Get-Head $url
    $last = $h
    if ($h.Code -eq 200 -and $h.ContentType -match 'application/pdf'){ return $h }
    Start-Sleep -Milliseconds $IntervalMs
  }
  return $last
}

Write-Stage "0) Traefik admin readiness"
$adminReady = Wait-Until { $null = Invoke-RestMethod "$Admin/api/overview" -TimeoutSec 3; $true } `
  -TimeoutSec $AdminReadyTimeoutSec -IntervalMs 500
if(-not $adminReady){ Write-Err "Admin API not ready at $Admin"; exit 1 }
Write-Ok "Admin API OK"

Write-Stage "1) Routers by provider"
$routers = Invoke-RestMethod "$Admin/api/http/routers"
$byFile   = $routers | Where-Object { $_.provider -eq 'file'   } | Select-Object name,entryPoints,rule
$byDocker = $routers | Where-Object { $_.provider -eq 'docker' } | Select-Object name,entryPoints,rule

Write-Host "`nFile provider (expect only traefik-admin@file):" -ForegroundColor Gray
$byFile | Format-Table -AutoSize
if(($byFile | Measure-Object).Count -ne 1 -or $byFile.name -notcontains 'traefik-admin@file'){
  Write-Err "Unexpected file-provider routers."
  exit 1
} else { Write-Ok "File provider OK" }

Write-Host "`nDocker provider (app routers):" -ForegroundColor Gray
$byDocker | Sort-Object name | Format-Table -AutoSize
$need = @('reports@docker','evidence@docker','time-series@docker','emission-factors@docker','webroot@docker','docs-reports@docker')
$missing = $need | Where-Object { $byDocker.name -notcontains $_ }
if($missing){ Write-Err "Missing docker routers: $($missing -join ', ')"; exit 1 } else { Write-Ok "Docker routers OK" }

Write-Stage "2) Health wall (spot checks)"
$paths = @(
  "/api/reports/health",
  "/api/evidence/health",
  "/api/time-series/health",
  "/api/emission-factors/health"
)
$failed = $false
foreach ($p in $paths) {
  try { $null = Invoke-RestMethod ($Base+$p) -TimeoutSec 5; Write-Ok ("{0} -> 200" -f $p) }
  catch { Write-Err ("{0} -> FAILED" -f $p); $failed = $true }
}
if($failed){ Write-Err "One or more health checks failed."; exit 1 }

Write-Stage "3) S2 org-aware build → flip → fetch"
$body = @{ template = "truststrip"; period = "2024Q4" } | ConvertTo-Json
$headersA = @{ "X-Org-Id" = $OrgA }
$headersB = @{ "X-Org-Id" = $OrgB }

# A) Build for OrgA
$respA = Invoke-RestMethod -Method POST -Uri "$Base/api/reports/build" -Headers $headersA -Body $body -ContentType "application/json"
$idA = $respA.artifactId
Write-Ok "Org '$OrgA' artifactId=$idA"

# B) Build for OrgB
$respB = Invoke-RestMethod -Method POST -Uri "$Base/api/reports/build" -Headers $headersB -Body $body -ContentType "application/json"
$idB = $respB.artifactId
Write-Ok "Org '$OrgB' artifactId=$idB"

# C) Wait for PDF flip on S2 route
$urlA = "$Base/api/evidence/orgs/$OrgA/artifacts/$idA/content"
$urlB = "$Base/api/evidence/orgs/$OrgB/artifacts/$idB/content"

$hA = Wait-ForPdf $urlA $FlipTimeoutSec $PollMs
$hB = Wait-ForPdf $urlB $FlipTimeoutSec $PollMs

if($hA.ContentType -notmatch 'application/pdf' -or $hA.Code -ne 200){
  Write-Err "Org '$OrgA' artifact didn't reach PDF in ${FlipTimeoutSec}s (last: $($hA.Code) $($hA.ContentType))"; exit 1
} else { Write-Ok "Org '$OrgA' final Content-Type: $($hA.ContentType)" }

if($hB.ContentType -notmatch 'application/pdf' -or $hB.Code -ne 200){
  Write-Err "Org '$OrgB' artifact didn't reach PDF in ${FlipTimeoutSec}s (last: $($hB.Code) $($hB.ContentType))"; exit 1
} else { Write-Ok "Org '$OrgB' final Content-Type: $($hB.ContentType)" }

# D) Cross-org negative checks (must be 404)
$wrongA = Get-Head "$Base/api/evidence/orgs/$OrgB/artifacts/$idA/content"
$wrongB = Get-Head "$Base/api/evidence/orgs/$OrgA/artifacts/$idB/content"

if($wrongA.Code -ne 404){ Write-Err "Cross-org fetch (idA via $OrgB) expected 404, got $($wrongA.Code)"; exit 1 } else { Write-Ok "Cross-org A→B correctly 404" }
if($wrongB.Code -ne 404){ Write-Err "Cross-org fetch (idB via $OrgA) expected 404, got $($wrongB.Code)"; exit 1 } else { Write-Ok "Cross-org B→A correctly 404" }

# E) (Informational) S1 back-compat route (ok if 404 or 200 depending on config)
$s1A = Get-Head "$Base/api/evidence/artifacts/$idA/content"
$s1B = Get-Head "$Base/api/evidence/artifacts/$idB/content"
Write-Host ("S1 route (OrgA): {0} {1}" -f $s1A.Code, $s1A.ContentType)
Write-Host ("S1 route (OrgB): {0} {1}" -f $s1B.Code, $s1B.ContentType)

Write-Stage "4) Logs"
Write-Host "`n- report-compiler org-aware persist lines (last 10m):" -ForegroundColor Gray
docker logs ct2-report-compiler-service-1 --since 10m | Select-String -Pattern 'artifact_persisted' -Context 0,6

Write-Host "`n- Traefik JSON access logs (tail $TraefikTail):" -ForegroundColor Gray
docker logs ct2-traefik-1 --tail $TraefikTail

Write-Host "`nALL GOOD ✅" -ForegroundColor Green
