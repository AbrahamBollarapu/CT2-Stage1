# Add minimal Stage-1 routes for kpi-calculation-service (PS 5.1-safe)
$ErrorActionPreference='Stop'
$svcDir = 'D:/CT2/apps/backend/services/kpi-calculation-service/src'
$routes = Join-Path $svcDir 'routes.ts'
if(!(Test-Path $svcDir)){ New-Item -ItemType Directory -Path $svcDir | Out-Null }

$code = @'
import type { Express, Request, Response } from "express";

export function registerRoutes(app: Express) {
  // POST /recompute  { account, period }
  app.post("/recompute", (req: Request, res: Response) => {
    const { account, period } = (req.body || {}) as { account?: string; period?: string };
    // Stage-1 stub: acknowledge recompute
    return res.json({ ok: true, account, period, recomputed: true });
  });

  // GET /list?account=...&period=...
  app.get("/list", (req: Request, res: Response) => {
    const { account, period } = req.query as { account?: string; period?: string };
    // Stage-1 stub payload (enough for smoke tests)
    return res.json({
      ok: true,
      account,
      period,
      kpis: [
        { key: "demo.kpi.sample", value: 42, unit: "pts" }
      ]
    });
  });
}
'@

$enc = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($routes, $code, $enc)
Write-Host "[patched] kpi-calculation-service/src/routes.ts written" -ForegroundColor Green
