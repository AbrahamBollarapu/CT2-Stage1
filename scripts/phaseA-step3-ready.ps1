# ================== Phase A / Step 3 — add /ready to S1 services (PS 5.1 safe) ==================
$ErrorActionPreference = 'Stop'

$RepoRoot = "D:/CT2"
$Backend  = Join-Path $RepoRoot "apps/backend"
$Services = @(
  "ingestion-service","evidence-store",
  "esg-service","time-series-service","emission-factors-service","data-quality-service",
  "kpi-calculation-service","report-compiler-service","xbrl-mapping-service",
  "dashboards-service","search-index-service","jobs-service"
)

function Write-Utf8NoBom($Path, $Text) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

$readyTs = @'
import { Express, Request, Response } from "express";
export function registerReady(app: Express) {
  app.get("/ready", async (_req: Request, res: Response) => {
    // TODO: add real dependency checks here (DB ping, queue, downstream svc)
    res.status(200).json({ ok: true });
  });
}
'@

foreach ($svc in $Services) {
  $svcDir = Join-Path $Backend "services/$svc"
  $srcDir = Join-Path $svcDir "src"
  if (-not (Test-Path $srcDir)) { Write-Warning "[skip] no src/ for $svc"; continue }

  # 1) ready.ts (idempotent overwrite is fine)
  Write-Host "[/ready] add ready.ts -> $svc" -ForegroundColor Cyan
  Write-Utf8NoBom (Join-Path $srcDir "ready.ts") $readyTs

  # 2) patch index.ts to import + register
  $indexPath = Join-Path $srcDir "index.ts"
  if (-not (Test-Path $indexPath)) { Write-Warning "[warn] missing src/index.ts in $svc"; continue }

  $content = Get-Content -Raw $indexPath

  # Skip if already wired
  if ($content -match "registerReady\s*\(") {
    Write-Host "[/ready] already wired -> $svc" -ForegroundColor DarkGray
    continue
  }

  # Ensure import exists (add at top if missing)
  if ($content -notmatch "import\s*\{\s*registerReady\s*\}\s*from\s*'./ready'") {
    $content = "import { registerReady } from './ready';`r`n" + $content
  }

  # Insert registerReady(app) after first line that assigns express() to const app
  $lines = $content -split "`r?`n"
  $inserted = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "const\s+app\s*=\s*express\(") {
      $lines = $lines[0..$i] + @("registerReady(app);") + $lines[($i+1)..($lines.Count-1)]
      $inserted = $true
      break
    }
  }

  if (-not $inserted) {
    # Fallback: insert before app.listen if present, else append at end
    $listenIndex = ($lines | Select-String -Pattern "app\.listen\s*\(" | Select-Object -First 1).LineNumber
    if ($listenIndex) {
      $idx = [int]$listenIndex - 1
      $lines = $lines[0..($idx-1)] + @("registerReady(app);") + $lines[$idx..($lines.Count-1)]
      $inserted = $true
    } else {
      $lines += "registerReady(app);"
      $inserted = $true
    }
  }

  $newContent = ($lines -join "`r`n")
  Write-Utf8NoBom $indexPath $newContent
  Write-Host "[/ready] wired -> $svc" -ForegroundColor Green
}

Write-Host "`nStep 3 (/ready) complete." -ForegroundColor Green
