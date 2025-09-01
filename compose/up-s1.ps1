param(
  [switch]$Recreate
)

$ErrorActionPreference = "Stop"

# 1) Pick docker compose flavor
$useDockerComposeExe = $false
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker CLI not found on PATH."
}
# Try 'docker compose version'
$null = & docker compose version 2>$null
if ($LASTEXITCODE -ne 0) {
  if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    $useDockerComposeExe = $true
  } else {
    throw "Neither 'docker compose' nor 'docker-compose' is available."
  }
}

# 2) Compose files to include (order matters)
$composeFiles = @(
  "docker-compose.yml",
  "docker-compose.traefik.yml",
  "docker-compose.mocks.stack.yml",
  "docker-compose.traefik.netfix.yml",
  "docker-compose.reports.router.yml",
  "docker-compose.evidence.router.yml",
  "docker-compose.artifacts.yml",
  "docker-compose.mocks.health-only.yml",
  "docker-compose.docs.yml",
  "docker-compose.landing.yml"
) | ForEach-Object { Join-Path $PSScriptRoot $_ }

# Validate existence (fail fast if a required file is missing)
$missing = $composeFiles | Where-Object { -not (Test-Path $_) }
if ($missing) {
  $missing -join "`n" | Write-Host
  throw "Missing compose file(s) above. Create them or remove from the list."
}

# 3) Build argument array
$cmd = @()
if ($useDockerComposeExe) {
  $cmd += "docker-compose"
} else {
  $cmd += "docker"; $cmd += "compose"
}
$cmd += @("-p","ct2")
foreach ($f in $composeFiles) { $cmd += @("-f", $f) }
$cmd += "up","-d"
if ($Recreate) { $cmd += "--force-recreate" }

# 4) Exec properly: exe + args
$exe  = $cmd[0]
$args = $cmd[1..($cmd.Count-1)]

Write-Host "Running: $exe $($args -join ' ')" -ForegroundColor Cyan
& $exe $args
if ($LASTEXITCODE -ne 0) { throw "Compose failed with exit code $LASTEXITCODE" }

Write-Host "`nStack is up. Quick checks:" -ForegroundColor Green
Write-Host "  - Traefik routers: http://localhost:8090/api/http/routers?search=reports"
Write-Host "  - Landing page  : http://localhost:8081/"
Write-Host "  - API docs      : http://localhost:8081/docs/reports"
