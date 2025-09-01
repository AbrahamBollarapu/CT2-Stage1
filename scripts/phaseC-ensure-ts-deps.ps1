# Add missing devDependencies: typescript + @types/node + @types/express (PS 5.1-safe)
$ErrorActionPreference='Stop'
$repo='D:/CT2'
$backend=Join-Path $repo 'apps/backend'
$services=@(
  'ingestion-service','evidence-store',
  'esg-service','time-series-service','emission-factors-service','data-quality-service',
  'kpi-calculation-service','report-compiler-service','xbrl-mapping-service',
  'dashboards-service','search-index-service','jobs-service'
)

# versions known-good with Express 4
$VERS = @{
  'typescript' = '^5.4.5'
  '@types/node' = '^20.11.30'
  '@types/express' = '^4.17.21'
}

foreach($s in $services){
  $pkgPath = Join-Path (Join-Path $backend "services/$s") 'package.json'
  if(-not (Test-Path $pkgPath)){ Write-Warning "[skip] $s missing package.json"; continue }
  try{
    $raw = Get-Content -Raw $pkgPath
    $pkg = $raw | ConvertFrom-Json
  } catch {
    Write-Warning "[warn] $s package.json not valid JSON"; continue
  }
  if(-not $pkg.devDependencies){ $pkg | Add-Member -NotePropertyName devDependencies -NotePropertyValue (@{}) }
  $changed = $false
  foreach($k in $VERS.Keys){
    if(-not $pkg.devDependencies.$k){
      $pkg.devDependencies.$k = $VERS.$k
      $changed = $true
    }
  }

  # make sure scripts.build exists and uses tsc -p .
  if(-not $pkg.scripts){ $pkg | Add-Member -NotePropertyName scripts -NotePropertyValue (@{}) }
  if(-not $pkg.scripts.build){ $pkg.scripts.build = "tsc -p ." ; $changed = $true }

  if($changed){
    $json = $pkg | ConvertTo-Json -Depth 50
    # write UTF-8 no BOM
    $enc = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($pkgPath,$json,$enc)
    Write-Host "[patched] $s devDeps/scripts" -ForegroundColor Cyan
  } else {
    Write-Host "[ok] $s already has TS devDeps" -ForegroundColor DarkGray
  }
}

Write-Host "Done. Docker build will 'npm ci || npm install' and pick these up." -ForegroundColor Green
