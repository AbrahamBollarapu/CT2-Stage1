# PS 5.1-safe: add /ready and registerOpenApi(app, ...) to specific services without nuking existing routes
$ErrorActionPreference = 'Stop'

$repo    = 'D:/CT2'
$baseDir = Join-Path $repo 'apps/backend/services'

$targets = @(
  @{ svc='esg-service';               title='esg-service'               },
  @{ svc='data-quality-service';      title='data-quality-service'      },
  @{ svc='report-compiler-service';   title='report-compiler-service'   }
)

function Write-Utf8NoBom([string]$p,[string]$t){
  $enc = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($p,$t,$enc)
}

foreach($t in $targets){
  $svc   = $t.svc
  $title = $t.title
  $src   = Join-Path (Join-Path $baseDir $svc) 'src'
  $idx   = Join-Path $src 'index.ts'

  if(!(Test-Path $src)){ New-Item -ItemType Directory -Path $src | Out-Null }

  if(!(Test-Path $idx)){
    # Fallback: minimal server
    $code = @"
import express from "express";
import { requestIdMiddleware } from "./request-id";
import { httpLogger } from "./http-logger";
import { registerOpenApi } from "./openapi";

const app = express();
app.use(express.json());
app.use(requestIdMiddleware);
app.use(httpLogger);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/ready",  (_req, res) => res.json({ ok: true }));
registerOpenApi(app, "${title}");

const port = Number(process.env.PORT || 8000);
app.listen(port, () => console.log("[${title}] listening on", port));
export default app;
"@
    Write-Utf8NoBom $idx $code
    Write-Host "[create] $svc/src/index.ts" -ForegroundColor Green
    continue
  }

  $raw = Get-Content -Raw $idx
  $changed = $false

  # Ensure import for registerOpenApi
  if($raw -notmatch '(?m)^\s*import\s*{\s*registerOpenApi\s*}\s*from\s*["'']\./openapi["'']\s*;'){
    $raw = "import { registerOpenApi } from './openapi';`r`n$raw"
    $changed = $true
  }

  # Ensure /ready route
  if($raw -notmatch "app\.get\(\s*['""]\/ready['""]"){
    $raw += "`r`napp.get('/ready', (_req, res) => res.json({ ok: true }));`r`n"
    $changed = $true
  }

  # Ensure OpenAPI registration
  if($raw -notmatch 'registerOpenApi\(\s*app'){
    $raw += "`r`nregisterOpenApi(app, '${title}');`r`n"
    $changed = $true
  }

  if($changed){
    Write-Utf8NoBom $idx $raw
    Write-Host "[patched] $svc/src/index.ts (+/ready +openapi)" -ForegroundColor Cyan
  } else {
    Write-Host "[ok] $svc already has /ready + openapi" -ForegroundColor DarkGray
  }
}

Write-Host "Ready/OpenAPI patch complete." -ForegroundColor Green
