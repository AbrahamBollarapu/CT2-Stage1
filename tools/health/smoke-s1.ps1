param([string]$Base="http://localhost:8081")

$ErrorActionPreference="Stop"
function J($o){$o|ConvertTo-Json -Depth 5}
function Head($u){(Invoke-WebRequest -UseBasicParsing -Method HEAD -Uri $u).Headers}

Write-Host "== S1 Smoke =="
$h=@(
 "$Base/api/reports/health",
 "$Base/api/evidence/health",
 "$Base/api/time-series/health",
 "$Base/api/emission-factors/health"
)
foreach($u in $h){ $r=Invoke-RestMethod -Method GET -Uri $u -TimeoutSec 5; Write-Host "$u -> ok=$($r.ok -or $r.status -eq 'healthy')" }

# Build
$body=@{template='truststrip';period='2024Q4'}|ConvertTo-Json
$resp=Invoke-RestMethod -Method POST -Uri "$Base/api/reports/build" -ContentType "application/json" -Body $body
$artifactId=$resp.artifactId
Write-Host "artifactId: $artifactId"

# Status (poll)
for($i=0;$i -lt 8;$i++){
  Start-Sleep 1
  $s=Invoke-RestMethod -Method GET -Uri "$Base/api/reports/status/$artifactId" -TimeoutSec 5
  Write-Host "status: $($s.state)"
  if($s.state -eq "completed"){break}
}

# Evidence head (stub -> final)
$h1=Head "$Base/api/evidence/artifacts/$artifactId/content"
Write-Host "Content-Type (t0): $($h1['Content-Type'])"
Start-Sleep 2
$h2=Head "$Base/api/evidence/artifacts/$artifactId/content"
Write-Host "Content-Type (t2): $($h2['Content-Type'])"

if($h2['Content-Type'] -ne 'application/pdf'){ throw "final not ready" }
Write-Host "S1 smoke passed ✅"
