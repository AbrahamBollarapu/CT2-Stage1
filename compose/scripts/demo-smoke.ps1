$ErrorActionPreference='Stop'
$Base  = "http://localhost:8081"
$H     = @{ "x-api-key"="ct2-dev-key"; "Content-Type"="application/json" }
function Ok($name,$cond){ if($cond){Write-Host "PASS - $name"} else{Write-Host "FAIL - $name"; exit 1} }

$r = Invoke-RestMethod -Method POST -Uri "$Base/api/esg/compute" -Headers $H -Body (@{account="demo"; period="2024Q4"} | ConvertTo-Json)
Ok "ESG /compute" ($r.ok -eq $true)

$r = Invoke-RestMethod -Method POST -Uri "$Base/api/data-quality/evaluate" -Headers $H -Body (@{account="demo"; period="2024Q4"} | ConvertTo-Json)
Ok "DQ /evaluate" ($r.ok -eq $true)

$r = Invoke-RestMethod -Method POST -Uri "$Base/api/time-series/points" -Headers $H -Body (@{
  org_id="demo"; meter="grid_kwh"; unit="kWh"; points=@(@{ts="2024-11-05T00:00:00Z"; value=118.0})
} | ConvertTo-Json -Depth 5)
Ok "TS /points" ($r.ok -eq $true)

$r = Invoke-RestMethod -Method POST -Uri "$Base/api/reports/build" -Headers $H -Body (@{template="truststrip"; period="2024Q4"} | ConvertTo-Json)
$artifactId = $r.artifactId
Ok "Reports /build" ([string]::IsNullOrEmpty($artifactId) -eq $false)

$status="queued"; $tries=0
while($status -ne "completed" -and $tries -lt 20){
  Start-Sleep -Milliseconds 500
  $s = Invoke-RestMethod "$Base/api/reports/status/$artifactId"
  $status = $s.status; $tries++
}
Ok "Reports /status completed" ($status -eq "completed")

$rsp = Invoke-WebRequest "$Base/api/reports/artifacts/$artifactId"
Ok "Reports /artifacts GET PDF" ($rsp.ContentLength -gt 0 -and $rsp.Headers."Content-Type" -like "application/pdf*")

Write-Host "ALL GOOD ✅"
