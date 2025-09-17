param(
  [switch]$Volumes,        # also remove named volumes
  [switch]$PruneNetworks   # also prune orphan docker networks
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Compose files we use in S1 (only include ones that exist)
$files = @(
  "docker-compose.yml",
  "docker-compose.traefik.yml",
  "docker-compose.routers.yml",
  "reports.cmd.yml"   # optional, include if present
) | Where-Object { Test-Path $_ }

if (-not $files -or $files.Count -eq 0) {
  Write-Error "No docker compose files found in $PSScriptRoot"
  exit 1
}

# Stable project name avoids the 'project name must not be empty' issue
$project = "ct2"

# Build docker compose arguments
$composeArgs = @("-p", $project)
$files | ForEach-Object { $composeArgs += @("-f", $_) }

# Down the stack
$downArgs = @("down")
if ($Volumes) { $downArgs += "-v" }

Write-Host ">> docker compose $($composeArgs -join ' ') $($downArgs -join ' ')"
docker compose @composeArgs @downArgs

# Optional cleanups
if ($PruneNetworks) {
  Write-Host ">> docker network prune (confirm suppressed)"
  docker network prune -f | Out-Null
}

Write-Host "✅ Stage-1 stack stopped/removed."
Write-Host "   Used compose files: $($files -join ', ')"
