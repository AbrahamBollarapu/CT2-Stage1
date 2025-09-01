# ========== Fix xbrl-mapping-service package.json and set scripts ==========
$ErrorActionPreference = 'Stop'
$pkgPath = 'D:\CT2\apps\backend\services\xbrl-mapping-service\package.json'

if (-not (Test-Path $pkgPath)) {
  Write-Error "Not found: $pkgPath"
  exit 1
}

# 1) Read raw and backup
$raw = Get-Content -Raw -Encoding UTF8 $pkgPath
Copy-Item $pkgPath "$pkgPath.bak" -Force

# 2) Sanitize common issues (no backrefs; PS 5.1-safe)
#    - Remove BOM
if ($raw.Length -gt 0 -and [int][char]$raw[0] -eq 0xFEFF) { $raw = $raw.Substring(1) }
#    - Remove /* ... */ blocks (naive but effective)
$raw = [regex]::Replace($raw, '/\*.*?\*/', '', 'Singleline')
#    - Strip // comments at EOL and pure comment lines
$raw = ($raw -split "`r?`n" | ForEach-Object { ($_ -replace '(^|\s)//.*$', '') }) -join "`r`n"
#    - Remove trailing commas before } or ]
$raw = $raw -replace ',\s*}', '}' -replace ',\s*]', ']'
#    - Trim whitespace
$raw = $raw.Trim()

# 3) Try parse
try {
  $pkg = $raw | ConvertFrom-Json
} catch {
  Write-Host "[xbrl] JSON still invalid after sanitize. Showing first lines for quick manual fix:" -ForegroundColor Yellow
  ($raw -split "`r?`n" | Select-Object -First 30) -join "`r`n" | Write-Host
  Write-Host "`nOpen the file, remove comments/trailing commas, ensure it starts with { ... }, then re-run this script." -ForegroundColor Yellow
  exit 1
}

# 4) Ensure scripts object exists and set entries (PS 5.1-safe property sets)
if (-not $pkg.PSObject.Properties['scripts']) {
  $pkg | Add-Member -NotePropertyName scripts -NotePropertyValue ([pscustomobject]@{}) -Force
}
# helper for safe prop set
function Set-Prop($obj, [string]$name, $value) {
  $prop = $obj.PSObject.Properties[$name]
  if ($prop) { $prop.Value = $value } else { $obj | Add-Member -NotePropertyName $name -NotePropertyValue $value -Force }
}
Set-Prop $pkg.scripts 'dev'        'ts-node-dev --respawn --transpile-only src/index.ts'
Set-Prop $pkg.scripts 'build'      'tsc -p .'
Set-Prop $pkg.scripts 'start'      'node dist/index.js'
Set-Prop $pkg.scripts 'start:prod' 'node dist/index.js'

# 5) Write back (pretty JSON), keep UTF-8 without BOM
$json = $pkg | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($pkgPath, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "[xbrl] package.json sanitized and scripts set." -ForegroundColor Green
