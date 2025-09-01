# ===== Dockerfile fix: use npm ci if lockfile exists, else npm install =====
$ErrorActionPreference = 'Stop'

$RepoRoot = "D:/CT2"
$Backend  = Join-Path $RepoRoot "apps/backend"
$Services = @(
  "ingestion-service","evidence-store",
  "esg-service","time-series-service","emission-factors-service","data-quality-service",
  "kpi-calculation-service","report-compiler-service","xbrl-mapping-service",
  "dashboards-service","search-index-service","jobs-service"
)

function Write-Utf8NoBom($Path, $Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

$dockerfile = @'
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# Use lockfile if present, else install
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Prod deps only; tolerate missing lockfile
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund; else npm install --omit=dev --no-audit --no-fund; fi
COPY --from=build /app/dist ./dist
CMD ["node","dist/index.js"]
'@

foreach ($svc in $Services) {
  $svcDir = Join-Path $Backend "services/$svc"
  if (-not (Test-Path $svcDir)) { Write-Warning "[skip] $svc not found at $svcDir"; continue }
  Write-Host "[dockerfile-fix] $svc" -ForegroundColor Cyan
  Write-Utf8NoBom (Join-Path $svcDir "Dockerfile") $dockerfile
}

Write-Host "`nDockerfile patch complete." -ForegroundColor Green
