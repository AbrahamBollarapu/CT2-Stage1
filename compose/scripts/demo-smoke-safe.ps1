$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

$Base = "http://localhost:8081"
$H    = @{ "x-api-key" = "ct2-dev-key" }

$script:FAILED = $false
function Ok($name, $cond) {
  if ($cond) { Write-Host "PASS - $name" -ForegroundColor Green }
  else       { Write-Host "FAIL - $name" -ForegroundColor Red; $script:FAILED = $true }
}
trap {
  Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
  $script:FAILED = $true
  continue
}

# --- Health checks ---
Ok "ESG /health"     ((Invoke-WebRequest -Method Get -Uri "$Base/api/esg/health").StatusCode -eq 200)
Ok "DQ /health"      ((Invoke-WebRequest -Method Get -Uri "$Base/api/data-quality/health").StatusCode -eq 200)
Ok "TS /health"      ((Invoke-WebRequest -Method Get -Uri "$Base/api/time-series/health").StatusCode -eq 200)
Ok "Factors /health" ((Invoke-WebRequest -Method Get -Uri "$Base/api/factors/health").StatusCode -eq 200)
Ok "Jobs /health"    ((Invoke-WebRequest -Method Get -Uri "$Base/api/jobs/health").StatusCode -eq 200)
Ok "Reports /health" ((Invoke-WebRequest -Method Get -Uri "$Base/api/reports/health").StatusCode -eq 200)

# --- Demo calls ---
$r = Invoke-RestMethod -Method Post -Uri "$Base/api/esg/compute" -Headers $H -ContentType "application/json" `
     -Body (@{ account="demo"; period="2024Q4" } | ConvertTo-Json)
Ok "ESG /compute" ($r.ok -eq $true)

$r = Invoke-RestMethod -Method Post -Uri "$Base/api/data-quality/evaluate" -Headers $H -ContentType "application/json" `
     -Body (@{ account="demo"; period="2024Q4" } | ConvertTo-Json)
Ok "DQ /evaluate" ($r.ok -eq $true)

$r = Invoke-RestMethod -Method Post -Uri "$Base/api/time-series/points" -Headers $H -ContentType "application/json" `
     -Body (@{
       org_id="demo"; meter="grid_kwh"; unit="kWh";
       points=@(@{ ts="2024-11-05T00:00:00Z"; value=118.0 })
     } | ConvertTo-Json -Depth 5)
Ok "TS /points" ($r.ok -eq $true)

$r = Invoke-RestMethod -Method Post -Uri "$Base/api/reports/build" -Headers $H -ContentType "application/json" `
     -Body (@{ template="truststrip"; period="2024Q4" } | ConvertTo-Json)
$artifactId = $r.artifactId
Ok "Reports /build" ([string]::IsNullOrEmpty($artifactId) -eq $false)

# --- Poll for completion ---
$status="queued"; $tries=0
while($status -ne "completed" -and $tries -lt 60){
  Start-Sleep -Milliseconds 500
  $status = (Invoke-RestMethod -Method Get -Uri "$Base/api/reports/status/$artifactId").status
  $tries++
}
Ok "Reports /status completed" ($status -eq "completed")

# --- Fetch artifact ---
$rspH = Invoke-WebRequest -Method Head -Uri "$Base/api/reports/artifacts/$artifactId"
Ok "Reports /artifacts HEAD is PDF" ($rspH.Headers."Content-Type" -like "application/pdf*")

New-Item -ItemType Directory -Path ".\out" -Force | Out-Null
$out = ".\out\truststrip-demo.pdf"
Invoke-WebRequest -Method Get -Uri "$Base/api/reports/artifacts/$artifactId" -OutFile $out
Ok "Saved PDF" ((Test-Path $out) -and ((Get-Item $out).Length -gt 0))
if (Test-Path $out) { Write-Host "✔ PDF saved to: $out" -ForegroundColor Cyan }

# --- Summary / pause ---
if ($script:FAILED) { Write-Warning "Some checks failed. See messages above." }
else { Write-Host "ALL CHECKS PASSED ✅" -ForegroundColor Green }
Read-Host "Done. Press Enter to close"
