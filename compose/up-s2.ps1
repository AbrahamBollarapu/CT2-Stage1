param(
  [switch]$Recreate,
  [switch]$RemoveOrphans,
  [switch]$SkipSmoke,
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
if ($Recreate)     { $flags += "--force-recreate" }
if ($RemoveOrphans){ $flags += "--remove-orphans" }

$cmd = "docker compose -p $Project $composeFiles up -d --build $($flags -join ' ')"
Write-Host "Running: $cmd" -ForegroundColor Cyan
Invoke-Expression $cmd

if (-not $SkipSmoke) {
  $smoke = Join-Path $PSScriptRoot "smoke-s2.ps1"
  if (Test-Path $smoke) {
    Write-Host "Running smoke-s2.ps1..." -ForegroundColor Cyan
    & $smoke
  } else {
    Write-Host "Stack is up. (smoke-s2.ps1 not found, skipping smoke)" -ForegroundColor Yellow
  }
}
