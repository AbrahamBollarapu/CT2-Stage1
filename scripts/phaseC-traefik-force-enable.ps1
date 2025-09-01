$ErrorActionPreference='Stop'
$composeDir = 'D:/CT2/compose'
$out = @"
services:
  esg-service:
    labels:
      - traefik.enable=true
      - traefik.http.services.esg-service.loadbalancer.server.port=8000
      - traefik.http.middlewares.esg-strip.stripPrefix.prefixes=/api/esg
      - traefik.http.routers.esg-service.rule=PathPrefix(`/api/esg`)
      - traefik.http.routers.esg-service.priority=2000
      - traefik.http.routers.esg-service.entrypoints=web
      - traefik.http.routers.esg-service.middlewares=esg-strip

  data-quality-service:
    labels:
      - traefik.enable=true
      - traefik.http.services.data-quality-service.loadbalancer.server.port=8000
      - traefik.http.middlewares.dq-strip.stripPrefix.prefixes=/api/data-quality
      - traefik.http.routers.data-quality-service.rule=PathPrefix(`/api/data-quality`)
      - traefik.http.routers.data-quality-service.priority=2000
      - traefik.http.routers.data-quality-service.entrypoints=web
      - traefik.http.routers.data-quality-service.middlewares=dq-strip

  report-compiler-service:
    labels:
      - traefik.enable=true
      - traefik.http.services.report-compiler-service.loadbalancer.server.port=8000
      - traefik.http.middlewares.reports-strip.stripPrefix.prefixes=/api/reports
      - traefik.http.routers.report-compiler-service.rule=PathPrefix(`/api/reports`)
      - traefik.http.routers.report-compiler-service.priority=2000
      - traefik.http.routers.report-compiler-service.entrypoints=web
      - traefik.http.routers.report-compiler-service.middlewares=reports-strip
"@
if(!(Test-Path $composeDir)){ New-Item -ItemType Directory -Path $composeDir | Out-Null }
$enc = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $composeDir 'docker-compose.prefix-force-enable.yml'), $out, $enc)
Write-Host "Wrote compose/docker-compose.prefix-force-enable.yml" -ForegroundColor Green
