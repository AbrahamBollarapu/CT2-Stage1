# Rewrites compose/docker-compose.health.yml and compose/docker-compose.env.yml in a safe style
$ErrorActionPreference='Stop'
$repo='D:/CT2'
$composeDir=Join-Path $repo 'compose'

$services=@(
  'ingestion-service','evidence-store',
  'esg-service','time-series-service','emission-factors-service','data-quality-service',
  'kpi-calculation-service','report-compiler-service','xbrl-mapping-service',
  'dashboards-service','search-index-service','jobs-service'
)

# ---------- HEALTH OVERLAY (no inline arrays, no weird quoting) ----------
$h=@()
$h+='services:'
foreach($s in $services){
  $h+=("  {0}:" -f $s)
  $h+='    healthcheck:'
  $h+='      test:'
  $h+='        - CMD-SHELL'
  $h+='        - wget -qO- http://localhost:8000/ready || exit 1'
  $h+='      interval: 10s'
  $h+='      timeout: 3s'
  $h+='      retries: 5'
  $h+='      start_period: 20s'
  $h+='    restart: unless-stopped'
  $h+=''
}
[IO.File]::WriteAllText((Join-Path $composeDir 'docker-compose.health.yml'),($h -join "`r`n"),(New-Object Text.UTF8Encoding($false)))

# ---------- ENV OVERLAY (explicit quoting for values with ':' and '${...}') ----------
$e=@()
$e+='services:'
foreach($s in $services){
  $e+=("  {0}:" -f $s)
  $e+='    environment:'
  $e+=("      SERVICE_NAME: ""{0}""" -f $s)
  $e+='      PORT: "${PORT:-8000}"'
  $e+='      LOG_LEVEL: "${LOG_LEVEL:-info}"'
  if($s -eq 'report-compiler-service'){
    $e+='      JOBS_SERVICE_URL: "${JOBS_SERVICE_URL:-http://jobs-service:8000}"'
    $e+='      REPORTS_COMPAT_LOG: "${REPORTS_COMPAT_LOG:-1}"'
    $e+='      REPORTS_COMPAT_SUNSET: "${REPORTS_COMPAT_SUNSET:-}"'
  }
  if($s -eq 'ingestion-service'){
    $e+='      INGEST_API_KEY: "${INGEST_API_KEY:-changeme}"'
    $e+='      SEARCH_INDEX_URL: "${SEARCH_INDEX_URL:-http://search-index-service:8000}"'
  }
  if($s -eq 'evidence-store'){
    $e+='      EVIDENCE_ROOT: "${EVIDENCE_ROOT:-/data}"'
  }
}
[IO.File]::WriteAllText((Join-Path $composeDir 'docker-compose.env.yml'),($e -join "`r`n"),(New-Object Text.UTF8Encoding($false)))

Write-Host "Overlays rewritten:" -ForegroundColor Green
Write-Host " - compose/docker-compose.health.yml" -ForegroundColor Green
Write-Host " - compose/docker-compose.env.yml" -ForegroundColor Green
