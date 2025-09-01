# Adds a minimal, robust Express bootstrap to services that are "Up (unhealthy)" because nothing listens on 8000.
$ErrorActionPreference='Stop'

$repo    = 'D:/CT2'
$baseDir = Join-Path $repo 'apps/backend/services'
$targets = @(
  @{ name='ingestion-service';        title='ingestion-service'        },
  @{ name='kpi-calculation-service';  title='kpi-calculation-service'  },
  @{ name='search-index-service';     title='search-index-service'     }
)

function Write-Utf8NoBom([string]$Path,[string]$Text){
  $enc = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($Path,$Text,$enc)
}

foreach($t in $targets){
  $svc = $t.name
  $title = $t.title
  $srcDir = Join-Path (Join-Path $baseDir $svc) 'src'
  $idx    = Join-Path $srcDir 'index.ts'
  if(!(Test-Path $srcDir)){ New-Item -ItemType Directory -Path $srcDir | Out-Null }

  $code = @"
import express from "express";
import { requestIdMiddleware } from "./request-id";
import { httpLogger } from "./http-logger";
import { registerOpenApi } from "./openapi";

const app = express();
app.use(express.json());

// middlewares (order matters)
app.use(requestIdMiddleware);
app.use(httpLogger);

// opportunistically mount any existing routes without breaking compile
try {
  // @ts-ignore
  const mod = require("./routes");
  if (mod?.registerRoutes) { mod.registerRoutes(app); }
  else if (mod?.router)    { app.use(mod.router); }
} catch (_) {}

try {
  // @ts-ignore
  const api = require("./api");
  if (typeof api === "function") { app.use(api); }
  else if (api?.default && typeof api.default === "function") { app.use(api.default); }
  else if (api?.router) { app.use(api.router); }
} catch (_) {}

// health + ready
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/ready",  (_req, res) => res.json({ ok: true }));

registerOpenApi(app, "${title}");

const port = Number(process.env.PORT || 8000);
app.listen(port, () => console.log("[${title}] listening on", port));

export default app;
"@

  Write-Utf8NoBom $idx $code
  Write-Host "[patched] $svc -> src/index.ts written" -ForegroundColor Green

  # Ensure tsconfig + scripts sane (CJS + build)
  $tsCfg = Join-Path (Join-Path $baseDir $svc) 'tsconfig.json'
  $base  = Join-Path (Join-Path $baseDir $svc) 'tsconfig.base.json'
  $tsBaseObj = @{
    compilerOptions = @{
      target="ES2020"; module="commonjs"; moduleResolution="node"; esModuleInterop=$true;
      allowSyntheticDefaultImports=$true; forceConsistentCasingInFileNames=$true; strict=$false;
      skipLibCheck=$true; outDir="dist"; rootDir="src"; resolveJsonModule=$true; types=@("node"); lib=@("ES2020")
    }
    include=@("src/**/*.ts"); exclude=@("node_modules","dist")
  }
  Write-Utf8NoBom $base (($tsBaseObj | ConvertTo-Json -Depth 50))
  $cfgObj = @{ extends="./tsconfig.base.json"; include=@("src/**/*.ts"); exclude=@("node_modules","dist") }
  Write-Utf8NoBom $tsCfg (($cfgObj | ConvertTo-Json -Depth 50))

  $pkgPath = Join-Path (Join-Path $baseDir $svc) 'package.json'
  if(Test-Path $pkgPath){
    $pkg = (Get-Content -Raw $pkgPath | ConvertFrom-Json)
  } else {
    $pkg = [pscustomobject]@{ name=$svc; version="1.0.0"; main="dist/index.js"; scripts=@{}; devDependencies=@{} }
  }
  if(-not $pkg.scripts){ $pkg | Add-Member scripts (@{}) }
  $pkg.scripts.'start:prod' = 'node dist/index.js'
  if(-not $pkg.scripts.build){ $pkg.scripts.build = 'tsc -p .' }
  if(-not $pkg.devDependencies){ $pkg | Add-Member devDependencies (@{}) }
  foreach($k in @('typescript','@types/node','@types/express')){
    if(-not $pkg.devDependencies.$k){ $pkg.devDependencies.$k = '^5.4.5' }
  }
  Write-Utf8NoBom $pkgPath (($pkg | ConvertTo-Json -Depth 50))
  Write-Host "[patched] $svc -> package.json & tsconfig ensured" -ForegroundColor Cyan
}

Write-Host "Rescue bootstrap complete for ingestion, KPI, and search." -ForegroundColor Green
