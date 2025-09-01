# Remove "type":"module" and ensure start:prod = node dist/index.js for all S1 services (PS 5.1-safe)
$ErrorActionPreference='Stop'
$repo='D:/CT2'
$backend=Join-Path $repo 'apps/backend'
$services=@(
  'ingestion-service','evidence-store',
  'esg-service','time-series-service','emission-factors-service','data-quality-service',
  'kpi-calculation-service','report-compiler-service','xbrl-mapping-service',
  'dashboards-service','search-index-service','jobs-service'
)

function Write-Utf8NoBom([string]$p,[string]$t){
  $enc = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($p,$t,$enc)
}

foreach($s in $services){
  $pkgPath = Join-Path (Join-Path $backend "services/$s") 'package.json'
  if(!(Test-Path $pkgPath)){ Write-Host "[skip] $s missing package.json" -ForegroundColor DarkYellow; continue }
  try{
    $raw = Get-Content -Raw $pkgPath
    $pkg = $raw | ConvertFrom-Json
  } catch {
    Write-Host "[warn] $s has invalid package.json" -ForegroundColor Yellow
    continue
  }

  $changed = $false
  # Remove "type":"module"
  if($pkg.PSObject.Properties.Name -contains 'type'){
    if($pkg.type -eq 'module'){ $pkg.PSObject.Properties.Remove('type'); $changed = $true }
  }
  # Ensure scripts + start:prod
  if(-not $pkg.scripts){ $pkg | Add-Member -NotePropertyName scripts -NotePropertyValue (@{}) }
  if($pkg.scripts.'start:prod' -ne 'node dist/index.js'){
    $pkg.scripts.'start:prod' = 'node dist/index.js'
    $changed = $true
  }

  if($changed){
    $json = $pkg | ConvertTo-Json -Depth 50
    Write-Utf8NoBom $pkgPath $json
    Write-Host "[patched] $s -> CJS enforced" -ForegroundColor Cyan
  } else {
    Write-Host "[ok] $s already CJS" -ForegroundColor DarkGray
  }
}
Write-Host "CJS enforcement complete." -ForegroundColor Green
