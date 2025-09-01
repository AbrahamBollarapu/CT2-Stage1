$ErrorActionPreference='Stop'
$composeDir = 'D:/CT2/compose'
$out = @"
version: "3.9"
services:
  esg-service:
    labels:
      - traefik.http.routers.esg-service.rule=PathPrefix(`/api/esg`)
      - traefik.http.routers.esg-service.middlewares=esg-service-strip
      - traefik.http.middlewares.esg-service-strip.stripPrefix.prefixes=/api/esg

  data-quality-service:
    labels:
      - traefik.http.routers.data-quality-service.rule=PathPrefix(`/api/data-quality`)
      - traefik.http.routers.data-quality-service.middlewares=data-quality-service-strip
      - traefik.http.middlewares.data-quality-service-strip.stripPrefix.prefixes=/api/data-quality

  report-compiler-service:
    labels:
      - traefik.http.routers.report-compiler-service.rule=PathPrefix(`/api/reports`)
      - traefik.http.routers.report-compiler-service.middlewares=report-compiler-service-strip
      - traefik.http.middlewares.report-compiler-service-strip.stripPrefix.prefixes=/api/reports
"@

if(!(Test-Path $composeDir)){ New-Item -ItemType Directory -Path $composeDir | Out-Null }
$enc = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $composeDir 'docker-compose.prefix-fix.yml'), $out, $enc)
Write-Host "Wrote compose/docker-compose.prefix-fix.yml" -ForegroundColor Green
