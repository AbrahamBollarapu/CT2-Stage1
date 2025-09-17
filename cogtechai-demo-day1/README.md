# CogTechAI — Five-Day Crash Plan (Day 1 Starter Kit)

This Day‑1 kit scaffolds the services and routing we need to begin the investor‑demo path.

## Prereqs
- Docker Desktop 4.x+
- Ports free: 8081 (web), 8090 (Traefik dashboard)

## Bring up (demo profile)
```powershell
cd cogtechai-demo-day1
docker compose -f docker-compose.demo.yml --profile demo up -d --build
# Open Traefik dashboard: http://localhost:8090
# Open UI: http://localhost:8081/
```
> If you already run Traefik elsewhere, you can comment out the `traefik` service and keep labels.
> Or change the host ports in compose.

## Health wall
```powershell
.\health_wall_demo.ps1 -Base "http://localhost:8081"
```

## Services & Routes (via Traefik)
- dashboards-service → `/` (priority 1; API routers have higher priority)
- jobs-service → `/api/jobs` (StripPrefix `/api/jobs` → service sees `/`)
  - `/api/jobs/health` → 200
  - `/api/jobs/run/demo` → 202 (stub)
- evidence-store → `/api/evidence`
  - `/api/evidence/health` → 200
  - Day 3: `/api/evidence/{id}/content` (HEAD/GET)
- time-series-service → `/api/time-series` (health only today)
- emission-factors-service → `/api/emission-factors` (health only today)

## Next (Day 2–5)
- Day 2: report-compiler (build/status/artifact), xbrl-mapping stub, fallback PDF; FE status poll
- Day 3: evidence HEAD/GET with headers; TS points; emission factors samples
- Day 4: Run Demo orchestration; retries/timeouts; polish
- Day 5: freeze versions; smoke script; Postman

---

**Note:** All services are Day‑1 stubs; replace with your real S1 microservices as they come online.