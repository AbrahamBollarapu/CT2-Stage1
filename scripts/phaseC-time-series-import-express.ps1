# Ensure time-series-service/src/index.ts imports express (PS 5.1-safe)
$ErrorActionPreference = 'Stop'
$idx = 'D:/CT2/apps/backend/services/time-series-service/src/index.ts'
if (!(Test-Path $idx)) { throw "Missing $idx" }

# Read file
$raw = Get-Content -Raw $idx

# Detect existing imports (either ESM or require)
$hasEsm     = ($raw -match "(?m)^\s*import\s+express\s+from\s+['""]express['""]\s*;")
$hasRequire = ($raw -match "(?m)^\s*const\s+express\s*=\s*require\(['""]express['""]\)")

if (-not ($hasEsm -or $hasRequire)) {
  $patched = "import express from 'express';`r`n$raw"
  $enc = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($idx, $patched, $enc)
  Write-Host "[patched] added express import to time-series-service/src/index.ts" -ForegroundColor Cyan
} else {
  Write-Host "[ok] express import already present" -ForegroundColor Green
}
