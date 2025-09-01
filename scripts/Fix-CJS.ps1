param(
  [string]$ServicesRoot = "D:\CT2\apps\backend\services"
)
$ErrorActionPreference = 'SilentlyContinue'
$S1 = @(
  'ingestion-service','evidence-store','esg-service','time-series-service',
  'emission-factors-service','data-quality-service','kpi-calculation-service',
  'report-compiler-service','xbrl-mapping-service','dashboards-service',
  'search-index-service','jobs-service'
)
$results = @()
foreach($name in $S1){
  $dir = Join-Path $ServicesRoot $name
  if(-not (Test-Path $dir)){
    $results += [pscustomobject]@{Service=$name; ChangedPkg=$false; ChangedTs=$false; Notes="MISSING: $dir"}
    continue
  }
  # package.json
  $pkgPath = Join-Path $dir "package.json"
  $changedPkg = $false
  if(Test-Path $pkgPath){
    Copy-Item $pkgPath "$pkgPath.ct2bak" -Force | Out-Null
    $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json -Depth 100
    if(-not $pkg.PSObject.Properties.Name.Contains('type') -or $pkg.type -eq 'module'){ $pkg.type = 'commonjs'; $changedPkg = $true }
    if(-not $pkg.scripts){ $pkg | Add-Member -NotePropertyName scripts -NotePropertyValue (@{}) }
    if(-not $pkg.scripts.build){ $pkg.scripts.build = 'tsc -p .' ; $changedPkg = $true }
    if(-not $pkg.scripts.'start:prod'){ $pkg.scripts.'start:prod' = 'node dist/index.js' ; $changedPkg = $true }
    ($pkg | ConvertTo-Json -Depth 100) | Set-Content -Encoding UTF8 $pkgPath
  } else {
    $results += [pscustomobject]@{Service=$name; ChangedPkg=$false; ChangedTs=$false; Notes="package.json missing"}
    continue
  }
  # tsconfig.json
  $tsPath = Join-Path $dir "tsconfig.json"
  $changedTs = $false
  if(Test-Path $tsPath){
    Copy-Item $tsPath "$tsPath.ct2bak" -Force | Out-Null
    $ts = Get-Content $tsPath -Raw | ConvertFrom-Json -Depth 100
    if(-not $ts.compilerOptions){ $ts | Add-Member -NotePropertyName compilerOptions -NotePropertyValue (@{}) }
    if($ts.compilerOptions.module -ne 'CommonJS'){ $ts.compilerOptions.module = 'CommonJS'; $changedTs = $true }
    if(-not $ts.compilerOptions.rootDir){ $ts.compilerOptions.rootDir = 'src'; $changedTs = $true }
    if(-not $ts.compilerOptions.outDir){ $ts.compilerOptions.outDir = 'dist'; $changedTs = $true }
    if(-not $ts.compilerOptions.esModuleInterop){ $ts.compilerOptions.esModuleInterop = $true; $changedTs = $true }
    if(-not $ts.compilerOptions.target){ $ts.compilerOptions.target = 'ES2020'; $changedTs = $true }
    ($ts | ConvertTo-Json -Depth 100) | Set-Content -Encoding UTF8 $tsPath
  } else {
    $results += [pscustomobject]@{Service=$name; ChangedPkg=$changedPkg; ChangedTs=$false; Notes="tsconfig.json missing"}
    continue
  }
  $mjs = Get-ChildItem -Path $dir -Recurse -Include *.mjs -File
  $note = if($mjs){ "Found *.mjs: "+($mjs.FullName -join ', ') } else { "" }
  $results += [pscustomobject]@{Service=$name; ChangedPkg=$changedPkg; ChangedTs=$changedTs; Notes=$note}
}
"---- Fix-CJS Summary ----"
$results | Format-Table -AutoSize
