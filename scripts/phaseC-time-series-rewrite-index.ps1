# Replace time-series-service/src/index.ts with a minimal, correct server (PS 5.1-safe)
$ErrorActionPreference='Stop'
$idx = 'D:/CT2/apps/backend/services/time-series-service/src/index.ts'

# Create folder if someone moved/cleaned it
$dir = Split-Path $idx
if(!(Test-Path $dir)){ New-Item -ItemType Directory -Path $dir | Out-Null }

$code = @'
import express from "express";
import { requestIdMiddleware } from "./request-id";
import { httpLogger } from "./http-logger";
import { registerOpenApi } from "./openapi";

// App
const app = express();
app.use(express.json());

// Middlewares (order matters)
app.use(requestIdMiddleware);
app.use(httpLogger);

// Health + Ready
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/ready",  (_req, res) => res.json({ ok: true }));

// OpenAPI stub
registerOpenApi(app, "time-series-service");

// Boot
const port = Number(process.env.PORT || 8000);
app.listen(port, () => {
  console.log(`[time-series-service] listening on ${port}`);
});

export default app;
'@

$enc = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($idx, $code, $enc)
Write-Host "[patched] time-series-service/src/index.ts rewritten" -ForegroundColor Green
