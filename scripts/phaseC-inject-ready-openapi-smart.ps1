# PS 5.1-safe: Find the TS file that calls app.listen(...) and inject /ready + registerOpenApi(app, "<title>")
$ErrorActionPreference='Stop'

$repo    = 'D:/CT2'
$baseDir = Join-Path $repo 'apps/backend/services'
$targets = @(
  @{ svc='esg-service';             title='esg-service' },
  @{ svc='data-quality-service';    title='data-quality-service' },
  @{ svc='report-compiler-service'; title='report-compiler-service' }
)

function Write-Utf8NoBom([string]$p,[string]$t){
  $enc = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($p,$t,$enc)
}

# Ensure a tiny openapi helper exists
function Ensure-OpenApiTs([string]$srcDir){
  $openapi = Join-Path $srcDir 'openapi.ts'
  if(Test-Path $openapi){ return }
  $code = @"
import type { Express } from "express";
export function registerOpenApi(app: Express, title: string) {
  app.get('/openapi.json', (_req, res) => {
    res.json({ openapi: '3.0.0', info: { title, version: '0.1.0' }, paths: {} });
  });
}
"@
  Write-Utf8NoBom $openapi $code
}

foreach($t in $targets){
  $svc   = $t.svc
  $title = $t.title
  $src   = Join-Path (Join-Path $baseDir $svc) 'src'
  if(!(Test-Path $src)){ New-Item -ItemType Directory -Path $src | Out-Null }

  Ensure-OpenApiTs $src

  # Pick the file that calls app.listen(...)
  $entry = $null
  Get-ChildItem -Path $src -Recurse -Filter *.ts | ForEach-Object {
    $txt = Get-Content -Raw $_.FullName
    if($txt -match 'app\s*\.\s*listen\s*\(' -and -not ($_.Name -like '*.d.ts')){
      if(-not $entry){ $entry = $_.FullName }
    }
  }

  if(-not $entry){
    # Fallback: create a minimal index.ts that will run alongside whatever exists.
    $entry = Join-Path $src 'index.ts'
    $code = @"
import express from "express";
import { registerOpenApi } from "./openapi";
const app = express();
app.get('/ready', (_req,res)=>res.json({ok:true}));
registerOpenApi(app, "${title}");
const port = Number(process.env.PORT || 8000);
app.listen(port, ()=>console.log("[${title}] ready/openapi shim on", port));
export default app;
"@
    Write-Utf8NoBom $entry $code
    Write-Host "[create] $svc/src/index.ts (shim)" -ForegroundColor Green
    continue
  }

  $raw = Get-Content -Raw $entry
  $changed = $false

  # Ensure import for registerOpenApi at top
  if($raw -notmatch '(?m)^\s*import\s*{\s*registerOpenApi\s*}\s*from\s*["'']\./openapi["'']\s*;'){
    # Insert after first import or at top
    if($raw -match '(?m)^\s*import .*;$'){
      $raw = $raw -replace '(?m)(^\s*import .*;$)','${0}' + "`r`n" + "import { registerOpenApi } from './openapi';", 1
    } else {
      $raw = "import { registerOpenApi } from './openapi';`r`n$raw"
    }
    $changed = $true
  }

  # Inject before app.listen(...): /ready + registerOpenApi(app, "<title>")
  if($raw -match 'app\s*\.\s*listen\s*\('){
    $inject = @"
app.get('/ready', (_req, res) => res.json({ ok: true }));
registerOpenApi(app, '${title}');
"@
    # Only add if not already present
    if($raw -notmatch "app\.get\(\s*['""]\/ready['""]" -or $raw -notmatch "registerOpenApi\(\s*app"){
      $raw = $raw -replace '(app\s*\.\s*listen\s*\()',$inject + "`r`n`$1", 1
      $changed = $true
    }
  }

  if($changed){
    Write-Utf8NoBom $entry $raw
    Write-Host "[patched] $svc -> $([IO.Path]::GetFileName($entry)) (+/ready +openapi)" -ForegroundColor Cyan
  } else {
    Write-Host "[ok] $svc already has /ready + openapi in $([IO.Path]::GetFileName($entry))" -ForegroundColor DarkGray
  }
}

Write-Host "Smart injection complete." -ForegroundColor Green
