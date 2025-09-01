param(
  [string]$DynPath # optional: explicit path to Traefik dynamic YAML
)
$ErrorActionPreference = 'Stop'

function Get-DynamicYamlPath {
  param([string]$Override)
  if ($Override -and (Test-Path $Override)) { return (Resolve-Path $Override).Path }
  $candidates = @(
    "D:\CT2\compose\traefik\dynamic.yml",
    "D:\CT2\compose\traefik.dynamic.yml",
    "D:\CT2\compose\traefik.yml",
    "D:\CT2\compose\dynamic.yml"
  ) + (Get-ChildItem -Path "D:\CT2\compose" -Filter "*.yml" -ErrorAction SilentlyContinue | % FullName)
  foreach ($p in $candidates | Select-Object -Unique) {
    if (Test-Path $p) {
      $txt = Get-Content -Raw $p -ErrorAction SilentlyContinue
      if ($txt -match "(?ms)^\s*http\s*:\s*\r?\n.*^\s*routers\s*:") { return $p }
    }
  }
  throw "Couldn't locate Traefik dynamic YAML. Pass -DynPath <file>."
}

function Get-FileRouterServiceName {
  param([string]$Router) # e.g. 'dyn-esg@file'
  try {
    $r = Invoke-RestMethod ("http://localhost:8090/api/http/routers/" + ($Router -replace "@","%40"))
    if ($r.service) { return $r.service }
  } catch {}
  return $null
}

# 1) locate the YAML
$path   = Get-DynamicYamlPath -Override $DynPath
$backup = "$path.bak-$(Get-Date -Format yyyyMMddHHmmss)"
Copy-Item $path $backup -Force

# 2) resolve service names from Traefik (fallback to sensible defaults)
$svcEsg  = Get-FileRouterServiceName -Router 'dyn-esg@file'
if (-not $svcEsg)  { $svcEsg  = 'svc-esg' }
$svcDq   = Get-FileRouterServiceName -Router 'dyn-data-quality@file'
if (-not $svcDq)   { $svcDq   = 'svc-dq' }
$svcRep  = Get-FileRouterServiceName -Router 'dyn-reports@file'
if (-not $svcRep)  { $svcRep  = 'svc-reports' }

# 3) load lines & find "http:" then "routers:"
$lines = Get-Content -Path $path -Encoding UTF8
$httpIdx = -1
for ($i=0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match "^\s*http\s*:\s*$") { $httpIdx = $i; break }
}
if ($httpIdx -lt 0) { throw "No 'http:' section found in $path" }

$routersIdx = -1
for ($i=$httpIdx+1; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match "^\s*routers\s*:\s*$") { $routersIdx = $i; break }
  # stop if we leave http: block (lower indent)
  if ($lines[$i] -match "^\S") { break }
}
if ($routersIdx -lt 0) { throw "No 'routers:' under http: in $path" }

# 4) compute indents
$routersIndent = ($lines[$routersIdx] -replace '^(\s*).*','$1')
$childIndent   = $routersIndent + '  '

# 5) avoid duplicates (skip if we already appended these)
$already = ($lines -join "`n") -match "(?m)^\s*fix-esg\s*:\s*$"
$toAdd = @()
if (-not $already) {
  $toAdd += "$childIndent" + "fix-esg:"
  $toAdd += "$childIndent  rule: PathPrefix(`/api/esg`)"
  $toAdd += "$childIndent  priority: 4000"
  $toAdd += "$childIndent  middlewares: [esg-strip@docker]"
  $toAdd += "$childIndent  service: $svcEsg"
  $toAdd += ""
  $toAdd += "$childIndent" + "fix-data-quality:"
  $toAdd += "$childIndent  rule: (PathPrefix(`/api/data-quality`) || PathPrefix(`/api/dataquality`))"
  $toAdd += "$childIndent  priority: 4000"
  $toAdd += "$childIndent  middlewares: [dq-strip@docker]"
  $toAdd += "$childIndent  service: $svcDq"
  $toAdd += ""
  $toAdd += "$childIndent" + "fix-reports:"
  $toAdd += "$childIndent  rule: PathPrefix(`/api/reports`)"
  $toAdd += "$childIndent  priority: 4000"
  $toAdd += "$childIndent  middlewares: [reports-strip@docker]"
  $toAdd += "$childIndent  service: $svcRep"
}

if ($toAdd.Count -gt 0) {
  # insert right after 'routers:' line
  $before = $lines[0..$routersIdx]
  $after  = $lines[($routersIdx+1)..($lines.Count-1)]
  $lines  = @($before + $toAdd + $after)
  Set-Content -Path $path -Value ($lines -join "`r`n") -Encoding UTF8
  Write-Host "Appended fix routers in $path (backup: $backup)" -ForegroundColor Green
} else {
  Write-Host "Fix routers already present in $path (backup: $backup)" -ForegroundColor Yellow
}

# 6) nudge Traefik to reload file provider
$traefik = "ct2-traefik-1"
try { docker kill -s HUP $traefik | Out-Null } catch { docker restart $traefik | Out-Null }
Start-Sleep -Seconds 1

# 7) show the three routers (file provider)
$routers = Invoke-RestMethod http://localhost:8090/api/http/routers
$routers |
  Where-Object { $_.name -in @('dyn-esg@file','dyn-data-quality@file','dyn-reports@file','fix-esg@file','fix-data-quality@file','fix-reports@file') } |
  Select-Object name, rule, priority, @{n='middlewares';e={ ($_.middlewares -join ',') }} |
  Sort-Object priority -Descending |
  Format-Table -AutoSize
