# Attaches docker strip middlewares to file-provider routers for /api/esg, /api/data-quality, /api/reports

$ErrorActionPreference = 'Stop'

# 1) Locate Traefik's dynamic config file mounted into the container
$traefik = "ct2-traefik-1"
$mounts = docker inspect $traefik --format "{{json .Mounts}}" | ConvertFrom-Json
$dyn = $mounts | Where-Object {
  $_.Destination -match "/etc/traefik/.*(dynamic|dyn).*\.ya?ml$" -or
  $_.Source      -match "(traefik|dynamic).*\.ya?ml$"
} | Select-Object -First 1

if (-not $dyn) { throw "Couldn't find a mounted dynamic YAML for Traefik. mounts:`n$($mounts | ConvertTo-Json -Depth 5)" }

$path   = $dyn.Source
$backup = "$path.bak-$(Get-Date -Format yyyyMMddHHmmss)"
Copy-Item $path $backup -Force

# 2) Read YAML as text (we'll do surgical line edits)
$y = Get-Content -Raw $path

function Upsert-Middlewares {
  param(
    [string]$yaml,
    [string]$router,      # e.g., 'dyn-esg'
    [string]$mw           # e.g., 'esg-strip@docker'
  )
  # Match the router block
  $blockPattern = "(?ms)^(\s*$router\s*:\s*\R(?:\s+.+\R)*?)((?=^\s*\S)|\z)"
  if ($yaml -notmatch $blockPattern) {
    Write-Warning "Router '$router' not found in $path"
    return $yaml
  }
  $block = $Matches[1]

  # If it already has a middlewares line, replace its value; else insert after the router header line
  if ($block -match "(?m)^\s*middlewares\s*:\s*\[.*\]") {
    $newBlock = ($block -replace "(?m)^(\\s*middlewares\\s*:\\s*)\\[.*\\]", "`${1}[$mw]")
  } else {
    # Try to insert after 'service:' if present; otherwise just after the router line
    if ($block -match "(?m)^(\s*service\s*:\s*[^\r\n]+)\s*$") {
      $indent = ($block -split "`n")[0] -replace "(\S).*",'$1' | ForEach-Object { ($_ -match "^\s*") | Out-Null; $Matches[0] }
      $newBlock = $block -replace "(?m)^(\s*service\s*:\s*[^\r\n]+)\s*$","`$1`r`n$indent  middlewares: [$mw]"
    } else {
      # Determine indent from first line
      $firstLine = ($block -split "`n")[0]
      $indent = ($firstLine -replace "(\S).*",'$1' | ForEach-Object { ($_ -match "^\s*") | Out-Null; $Matches[0] }) + "  "
      $newBlock = $block -replace "(?m)^(\s*$router\s*:\s*)\R","`$1`r`n$indentmiddlewares: [$mw]`r`n"
    }
  }

  # Replace the old block in the YAML
  return ($yaml -replace [Regex]::Escape($block), [System.Text.RegularExpressions.Regex]::Escape($newBlock) -replace '\\\\','\')
}

# 3) Apply to the three routers
$y = Upsert-Middlewares $y 'dyn-esg'            'esg-strip@docker'
$y = Upsert-Middlewares $y 'dyn-data-quality'   'dq-strip@docker'
$y = Upsert-Middlewares $y 'dyn-reports'        'reports-strip@docker'

# 4) Write back and bounce Traefik
Set-Content -Path $path -Value $y -Encoding UTF8 -NoNewline
Write-Host "Patched $path (backup at $backup)" -ForegroundColor Green

docker compose `
  -f compose\docker-compose.yml `
  -f compose\docker-compose.traefik.yml `
  -f compose\docker-compose.s1.yml `
  -f compose\docker-compose.env.yml `
  -f compose\docker-compose.health.yml `
  restart traefik | Out-Null

Start-Sleep -Seconds 1

# 5) Quick verify
$routers = Invoke-RestMethod http://localhost:8090/api/http/routers
$routers |
  Where-Object { $_.name -in @('dyn-esg@file','dyn-data-quality@file','dyn-reports@file') } |
  Select-Object name, rule, @{n='middlewares';e={ ($_.middlewares -join ',') }} |
  Format-Table -AutoSize
