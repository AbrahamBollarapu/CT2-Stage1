param([switch]$Rebuild)

$files = @(
  "docker-compose.demo.yml",
  "docker-compose.demo.override.yml",
  "docker-compose.demo.override.routes.yml",       # <— new
  "docker-compose.demo.override.time-series.yml"
)

$cmd = "docker compose --profile demo -f " + ($files -join " -f ") + " up -d"
if ($Rebuild) { $cmd += " --build" }

Write-Host $cmd -ForegroundColor Cyan
iex $cmd

docker compose --profile demo -f ($files -join " -f ") ps

# Run smoke (will use 8090 for admin which is now mapped again)
& (Join-Path $PSScriptRoot "scripts\demo-smoke-now.ps1")
