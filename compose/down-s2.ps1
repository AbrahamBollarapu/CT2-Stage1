param(
  [switch]$RemoveOrphans,
  [string]$Project = "ct2"
)

$composeFiles = @(
  "docker-compose.yml",
  "docker-compose.traefik.yml",
  "docker-compose.traefik.hardening.yml",
  "docker-compose.mocks.stack.yml",
  "docker-compose.traefik.netfix.yml",
  "docker-compose.reports.router.yml",
  "docker-compose.evidence.router.yml",
  "docker-compose.artifacts.yml",
  "docker-compose.docs.yml",
  "docker-compose.landing.yml",
  "docker-compose.mocks.health-only.yml"
) | ForEach-Object { "-f `"$PSScriptRoot\$_`"" } -join " "

$flags = @()
if ($RemoveOrphans) { $flags += "--remove-orphans" }

$cmd = "docker compose -p $Project $composeFiles down $($flags -join ' ')"
Write-Host "Running: $cmd" -ForegroundColor Cyan
Invoke-Expression $cmd

# Optional: remove the compose-managed network if you want a fresh start
docker network rm ct2_ct2-net 2>$null | Out-Null
