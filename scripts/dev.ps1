# Dev: start Docker infra and run frontend dev if desired
docker compose -f ./infra/docker/compose/docker-compose.dev.yml up -d
Write-Host 'Traefik: http://localhost (web) • Dashboard: http://localhost:8080'
