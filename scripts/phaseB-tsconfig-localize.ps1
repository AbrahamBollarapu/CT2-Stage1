# ===== Localize tsconfig.base.json per service and fix extends path (PS 5.1 safe) =====
$ErrorActionPreference = 'Stop'

# --- CONFIG ---
$RepoRoot = 'D:/CT2'
$Backend  = Join-Path $RepoRoot 'apps/backend'
$Services = @(
  'ingestion-service','evidence-store',
  'esg-service','time-series-service','emission-factors-service','data-quality-service',
  'kpi-calculation-service','report-compiler-service','xbrl-mapping-service',
  'dashboards-service','search-index-service','jobs-service'
)

# --- Helpers ---
function Write-Utf8NoBom { param([string]$Path,[string]$Text)
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

# base tsconfig content to drop into each service
$baseTs = @'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
'@

foreach ($svc in $Services) {
  $svcDir = Join-Path $Backend "services/$svc"
  if (-not (Test-Path $svcDir)) { Write-Warning "[skip] $svc not found at $svcDir"; continue }

  # 1) write local base so Docker build context has it
  $localBase = Join-Path $svcDir 'tsconfig.base.json'
  Write-Host "[ts-base] $svc -> tsconfig.base.json" -ForegroundColor Cyan
  Write-Utf8NoBom $localBase $baseTs

  # 2) ensure tsconfig.json points to ./tsconfig.base.json
  $tscfgPath = Join-Path $svcDir 'tsconfig.json'
  if (-not (Test-Path $tscfgPath)) {
    Write-Host "[tsconfig.json] create -> $svc" -ForegroundColor Yellow
    $obj = [pscustomobject]@{
      extends = "./tsconfig.base.json"
      include = @("src/**/*")
      exclude = @("node_modules","dist")
    }
  } else {
    try {
      $obj = Get-Content -Raw $tscfgPath | ConvertFrom-Json
    } catch {
      Write-Warning "[warn] invalid JSON in $tscfgPath - rewriting minimal tsconfig.json"
      $obj = [pscustomobject]@{}
    }
    if (-not $obj) { $obj = [pscustomobject]@{} }
    if ($obj.PSObject.Properties['extends']) { $obj.extends = "./tsconfig.base.json" }
    else { $obj | Add-Member -NotePropertyName extends -NotePropertyValue "./tsconfig.base.json" -Force }
    if (-not $obj.PSObject.Properties['include']) { $obj | Add-Member -NotePropertyName include -NotePropertyValue @("src/**/*") -Force }
    if (-not $obj.PSObject.Properties['exclude']) { $obj | Add-Member -NotePropertyName exclude -NotePropertyValue @("node_modules","dist") -Force }
  }

  $out = $obj | ConvertTo-Json -Depth 50
  Write-Utf8NoBom $tscfgPath $out
  Write-Host "[ts-extends] $svc -> ./tsconfig.base.json" -ForegroundColor Green
}

Write-Host ""
Write-Host "Localized tsconfig base per service. Ready to rebuild." -ForegroundColor Green
