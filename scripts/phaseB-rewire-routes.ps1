# ===== Make new Jobs/Reports APIs load FIRST (PS 5.1 safe) =====
$ErrorActionPreference = 'Stop'

$RepoRoot = 'D:/CT2'
$Backend  = Join-Path $RepoRoot 'apps/backend'

function Write-Utf8NoBom([string]$Path,[string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Rewire-Service($svcName, $importName, $importFile, $registerCall) {
  $svcDir = Join-Path $Backend "services/$svcName"
  $srcDir = Join-Path $svcDir "src"
  $idx    = Join-Path $srcDir "index.ts"
  if (-not (Test-Path $idx)) { Write-Warning "[skip] $svcName index.ts not found"; return }

  $content = Get-Content -Raw $idx

  # 1) Ensure import exists at the very top (idempotent)
  if ($content -notmatch "import\s*\{\s*$importName\s*\}\s*from\s*'./$importFile'") {
    $content = "import { $importName } from './$importFile';`r`n" + $content
  }

  # 2) Ensure body parser present
  if ($content -notmatch "app\.use\(\s*express\.json\(\)\s*\)") {
    $content = $content -replace "const\s+app\s*=\s*express\(\)\s*;", "const app = express();`r`napp.use(express.json());"
  }

  # 3) Remove any existing later occurrences of the registration to avoid dupes
  $content = [regex]::Replace($content, [regex]::Escape("$registerCall(app);"), "", "IgnoreCase")

  # 4) Insert the registration *immediately after* the 'const app = express()' line
  $lines = $content -split "`r?`n"
  $inserted = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "const\s+app\s*=\s*express\(") {
      # insert on next line
      $before = $lines[0..$i]
      $after  = $lines[($i+1)..($lines.Count-1)]
      $lines  = $before + @("$registerCall(app);") + $after
      $inserted = $true
      break
    }
  }
  if (-not $inserted) {
    # fallback: put near top
    $lines = @("const app = express();","app.use(express.json());","$registerCall(app);") + $lines
  }

  $newContent = ($lines -join "`r`n")
  Write-Utf8NoBom $idx $newContent
  Write-Host "[rewired] $svcName → $registerCall(app) placed right after app creation" -ForegroundColor Green
}

# Jobs: registerJobsApi first
Rewire-Service -svcName 'jobs-service' -importName 'registerJobsApi' -importFile 'jobs-api' -registerCall 'registerJobsApi'

# Reports: registerReportsApi first
Rewire-Service -svcName 'report-compiler-service' -importName 'registerReportsApi' -importFile 'reports-api' -registerCall 'registerReportsApi'

Write-Host "`nRoute order rewired. Rebuild without cache next." -ForegroundColor Cyan
