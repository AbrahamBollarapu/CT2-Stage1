param(
  [string]$DynPath # optional: path to Traefik file-provider YAML
)
$ErrorActionPreference = 'Stop'

function Get-DynamicYamlPath {
  param([string]$Override)
  if ($Override -and (Test-Path $Override)) { return (Resolve-Path $Override).Path }

  $traefik = "ct2-traefik-1"
  try {
    $mountsJson = docker inspect $traefik --format "{{json .Mounts}}"
    $mounts = $mountsJson | ConvertFrom-Json
    foreach ($m in $mounts) {
      if ($m.Source -match "\.ya?ml$" -and (Test-Path $m.Source)) {
        $txt = Get-Content -Raw $m.Source
        if ($txt -match "(?ms)^\s*http\s*:\s*\r?\n.*^\s*routers\s*:") { return $m.Source }
      }
    }
  } catch {}

  $candidates = @(
    "D:\CT2\compose\traefik.dynamic.yml",
    "D:\CT2\compose\traefik.yml",
    "D:\CT2\compose\dynamic.yml"
  ) + (Get-ChildItem -Path "D:\CT2\compose" -Filter "*.yml" -ErrorAction SilentlyContinue | % FullName)

  foreach ($p in $candidates | Select-Object -Unique) {
    if (Test-Path $p) {
      $txt = Get-Content -Raw $p
      if ($txt -match "(?ms)^\s*http\s*:\s*\r?\n.*^\s*routers\s*:") { return $p }
    }
  }
  throw "Couldn't locate Traefik dynamic YAML. Pass -DynPath <file>."
}

function Upsert-Middlewares {
  param(
    [string[]]$Lines,
    [string]$RouterName,
    [string]$MiddlewareRef
  )
  # find router header line (e.g. "  dyn-esg:")
  $start = -1
  for ($i=0; $i -lt $Lines.Count; $i++) {
    if ($Lines[$i] -match ("^\s*" + [regex]::Escape($RouterName) + "\s*:\s*$")) { $start = $i; break }
  }
  if ($start -lt 0) { Write-Warning "Router '$RouterName' not found"; return ,$Lines }

  $routerIndent = ($Lines[$start] -replace '^(\s*).*','$1')

  # block end = first non-empty line whose indent <= routerIndent (or EOF)
  $end = $Lines.Count - 1
  for ($j=$start+1; $j -lt $Lines.Count; $j++) {
    $cur = $Lines[$j]
    if ($cur -match "^\s*\S") {
      $curIndent = ($cur -replace '^(\s*).*','$1')
      if ($curIndent.Length -le $routerIndent.Length) { $end = $j-1; break }
    }
  }

  # locate existing keys
  $mwIdx = -1; $svcIdx = -1; $svcIndent = $null
  for ($k=$start+1; $k -le $end; $k++) {
    if ($Lines[$k] -match "^\s*middlewares\s*:") { $mwIdx = $k }
    if ($Lines[$k] -match "^\s*service\s*:\s*") { $svcIdx = $k; $svcIndent = ($Lines[$k] -replace '^(\s*).*','$1') }
  }

  if ($mwIdx -ge 0) {
    $mwIndent = ($Lines[$mwIdx] -replace '^(\s*).*','$1')
    $Lines[$mwIdx] = "$mwIndent" + 'middlewares: [' + $MiddlewareRef + ']'
    return ,$Lines
  }

  # insert a new middlewares line (after service if present)
  $insertAt = $start + 1
  if ($svcIdx -ge 0) { $insertAt = $svcIdx + 1 }

  $indent = $routerIndent + "  "
  if ($svcIndent) { $indent = $svcIndent }

  $newLine = "$indent" + 'middlewares: [' + $MiddlewareRef + ']'

  if ($insertAt -ge $Lines.Count) {
    $Lines = @($Lines + $newLine)
  } else {
    if ($insertAt -le 0) {
      $after = $Lines
      $Lines = @($newLine + $after)
    } else {
      $before = $Lines[0..($insertAt-1)]
      $after  = $Lines[$insertAt..($Lines.Count-1)]
      $Lines  = @($before + $newLine + $after)
    }
  }
  return ,$Lines
}

# 1) Locate YAML
$path = Get-DynamicYamlPath -Override $DynPath
$backup = "$path.bak-$(Get-Date -Format yyyyMMddHHmmss)"
Copy-Item $path $backup -Force

# 2) Load
$raw = Get-Content -Raw $path -Encoding UTF8
if ($raw -notmatch "(?ms)^\s*http\s*:\s*\r?\n.*^\s*routers\s*:") {
  throw "File '$path' does not contain http->routers section."
}
$lines = $raw -split "`r?`n"

# 3) Apply patches
$lines = Upsert-Middlewares -Lines $lines -RouterName 'dyn-esg'          -MiddlewareRef 'esg-strip@docker'
$lines = Upsert-Middlewares -Lines $lines -RouterName 'dyn-data-quality' -MiddlewareRef 'dq-strip@docker'
$lines = Upsert-Middlewares -Lines $lines -RouterName 'dyn-reports'      -MiddlewareRef 'reports-strip@docker'

# 4) Save
Set-Content -Path $path -Value ($lines -join "`r`n") -Encoding UTF8
Write-Host "Patched $path (backup at $backup)" -ForegroundColor Green

# 5) Reload Traefik (file provider usually auto-watches)
$traefik = "ct2-traefik-1"
try { docker kill -s HUP $traefik | Out-Null } catch { docker restart $traefik | Out-Null }
Start-Sleep -Seconds 1

# 6) Show the three file routers
$routers = Invoke-RestMethod http://localhost:8090/api/http/routers
$routers |
  Where-Object { $_.name -in @('dyn-esg@file','dyn-data-quality@file','dyn-reports@file') } |
  Select-Object name, rule, priority, @{n='middlewares';e={ ($_.middlewares -join ',') }} |
  Format-Table -AutoSize
