# ================== Phase A / Step 2 — patch S1 services (PS 5.1 safe) ==================
$ErrorActionPreference = 'Stop'

# --- CONFIG ---
$RepoRoot   = "D:/CT2"
$Backend    = Join-Path $RepoRoot "apps/backend"
$Services   = @(
  "ingestion-service","evidence-store",
  "esg-service","time-series-service","emission-factors-service","data-quality-service",
  "kpi-calculation-service","report-compiler-service","xbrl-mapping-service",
  "dashboards-service","search-index-service","jobs-service"
)

# --- Helpers ---
function Write-Utf8NoBom($Path, $Text) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}
function Ensure-Object([object]$v) {
  if ($null -eq $v) { return [pscustomobject]@{} }
  return $v
}
function Set-Prop($obj, [string]$name, $value) {
  $prop = $obj.PSObject.Properties[$name]
  if ($prop) { $prop.Value = $value } else { $obj | Add-Member -NotePropertyName $name -NotePropertyValue $value -Force }
}

# Here-strings must be on their own lines in PS 5.1
$tscfg = @'
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
'@

$dockerfile = @'
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
CMD ["node", "dist/index.js"]
'@

foreach ($svc in $Services) {
  $svcDir = Join-Path $Backend "services/$svc"
  if (-not (Test-Path $svcDir)) { Write-Warning "[skip] $svc not found at $svcDir"; continue }

  # 1) tsconfig.json
  Write-Host "[tsconfig] $svc" -ForegroundColor Cyan
  Write-Utf8NoBom (Join-Path $svcDir "tsconfig.json") $tscfg

  # 2) package.json scripts
  $pkgPath = Join-Path $svcDir "package.json"
  if (Test-Path $pkgPath) {
    $pkg = Get-Content -Raw $pkgPath | ConvertFrom-Json

    # make sure scripts is an object
    if (-not $pkg.PSObject.Properties['scripts']) {
      $pkg | Add-Member -NotePropertyName scripts -NotePropertyValue ([pscustomobject]@{}) -Force
    }
    $pkg.scripts = Ensure-Object $pkg.scripts

    # set/update script entries safely (works with keys containing ':')
    Set-Prop $pkg.scripts 'dev'          'ts-node-dev --respawn --transpile-only src/index.ts'
    Set-Prop $pkg.scripts 'build'        'tsc -p .'
    Set-Prop $pkg.scripts 'start'        'node dist/index.js'
    Set-Prop $pkg.scripts 'start:prod'   'node dist/index.js'

    $json = $pkg | ConvertTo-Json -Depth 100
    Write-Host "[scripts] $svc" -ForegroundColor Cyan
    Write-Utf8NoBom $pkgPath $json
  } else {
    Write-Warning "[warn] package.json missing for $svc"
  }

  # 3) Dockerfile (two-stage)
  Write-Host "[dockerfile] $svc" -ForegroundColor Cyan
  Write-Utf8NoBom (Join-Path $svcDir "Dockerfile") $dockerfile

  # 4) .env.local.example
  $envSample = @"
# Common
PORT=8000
SERVICE_NAME=$svc
LOG_LEVEL=info
# Ingestion
INGEST_API_KEY=changeme
# Evidence
EVIDENCE_BUCKET_PATH=/data/evidence
# Postgres (if used)
PGHOST=postgres
PGPORT=5432
PGDATABASE=
PGUSER=
PGPASSWORD=
"@
  Write-Host "[env] $svc" -ForegroundColor Cyan
  Write-Utf8NoBom (Join-Path $svcDir ".env.local.example") $envSample
}

Write-Host "`nStep 2 complete." -ForegroundColor Green
