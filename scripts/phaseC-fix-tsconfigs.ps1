# Fix tsconfig chain for all S1 services: ensure extends "./tsconfig.base.json" and write a sane base.
$ErrorActionPreference='Stop'
$repo='D:/CT2'
$backend=Join-Path $repo 'apps/backend'
$services=@(
  'ingestion-service','evidence-store',
  'esg-service','time-series-service','emission-factors-service','data-quality-service',
  'kpi-calculation-service','report-compiler-service','xbrl-mapping-service',
  'dashboards-service','search-index-service','jobs-service'
)

function Write-Utf8NoBom([string]$Path,[string]$Text){
  $enc = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($Path,$Text,$enc)
}

$baseObj = @{
  compilerOptions = @{
    target = "ES2020"
    module = "commonjs"
    moduleResolution = "node"
    esModuleInterop = $true
    allowSyntheticDefaultImports = $true
    forceConsistentCasingInFileNames = $true
    strict = $false
    skipLibCheck = $true
    outDir = "dist"
    rootDir = "src"
    resolveJsonModule = $true
    types = @("node")
    lib = @("ES2020")
  }
  include = @("src/**/*.ts")
  exclude = @("node_modules","dist")
}

foreach($s in $services){
  $svcDir = Join-Path $backend "services/$s"
  $tsBase = Join-Path $svcDir 'tsconfig.base.json'
  $tsCfg  = Join-Path $svcDir 'tsconfig.json'

  if(-not (Test-Path $svcDir)){ Write-Warning "[skip] $s dir missing"; continue }

  # 1) Write/overwrite local tsconfig.base.json
  $jsonBase = ($baseObj | ConvertTo-Json -Depth 50)
  Write-Utf8NoBom $tsBase $jsonBase

  # 2) Ensure tsconfig.json extends local base
  if(Test-Path $tsCfg){
    try{
      $raw = Get-Content -Raw $tsCfg
      $obj = $raw | ConvertFrom-Json
    } catch {
      Write-Warning "[warn] $s tsconfig.json invalid JSON, rewriting minimal"
      $obj = $null
    }
  } else { $obj = $null }

  if($obj -eq $null){ $obj = @{ extends = "./tsconfig.base.json"; include = @("src/**/*.ts"); exclude=@("node_modules","dist") } }
  else {
    $obj.extends = "./tsconfig.base.json"
    if(-not $obj.include){ $obj.include=@("src/**/*.ts") }
    if(-not $obj.exclude){ $obj.exclude=@("node_modules","dist") }
  }

  $jsonCfg = $obj | ConvertTo-Json -Depth 50
  Write-Utf8NoBom $tsCfg $jsonCfg

  Write-Host "[tsconfig] fixed -> $s" -ForegroundColor Cyan
}

Write-Host "All tsconfigs normalized (local base, CJS, esModuleInterop, etc.)." -ForegroundColor Green
