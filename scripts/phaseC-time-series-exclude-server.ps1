# Exclude src/server.ts from time-series-service compilation (PS 5.1-safe)
$ErrorActionPreference='Stop'
$svcDir = 'D:/CT2/apps/backend/services/time-series-service'
$tscfg  = Join-Path $svcDir 'tsconfig.json'

if (!(Test-Path $tscfg)) { throw "tsconfig.json not found at $tscfg" }

# Read/parse JSON
$raw = Get-Content -Raw $tscfg
try { $obj = $raw | ConvertFrom-Json } catch { $obj = @{} }

# Ensure exclude exists and contains server.ts
if (-not $obj.exclude) { $obj.exclude = @("node_modules","dist") }
if ($obj.exclude -isnot [System.Collections.IList]) { $obj.exclude = @($obj.exclude) }
if (-not ($obj.exclude -contains "src/server.ts")) { $obj.exclude += "src/server.ts" }

# Write back UTF-8 (no BOM)
$enc = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($tscfg, ($obj | ConvertTo-Json -Depth 50), $enc)
Write-Host "[tsconfig] time-series-service -> excluded src/server.ts" -ForegroundColor Green
