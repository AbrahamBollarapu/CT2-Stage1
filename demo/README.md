# CogTechAI — Investor Demo Kit
Prepared: 2025-09-16 (IST)

This kit contains **Day‑1** assets to kick off the Five‑Day Crash Plan for the **Investor‑Demo** cut.

## Contents
- `postman/CogTechAI_S1_InvestorDemo.postman_collection.json` — Postman collection with the S1 happy path
- `scripts/smoke-demo.ps1` — One‑shot PowerShell smoke script (Windows)
- `seed/*` — Seed fixtures for suppliers, time‑series, and emission factors
- `compose/docker-compose.demo.override.yml` — Demo-only compose profile (template)
- `frontend/landing.html` — Minimal landing with links to endpoints/docs (placeholder)

## Five‑Day Crash Plan — Checkpoints (Day 1 focus)
- [ ] FE scaffold for `/landing`, `/dashboard`, `/evidence/:id`, `/suppliers`
- [ ] Compose: add **image/build** for `time-series-service (8025)`, `emission-factors-service (8021)`, `dashboards-service`
- [ ] `jobs-service`: add `/health` and `POST /api/jobs/run/demo`
- [ ] `evidence-store`: finalize HEAD/GET content headers
- [ ] Traefik: routes for `/api/<svc>` and `/health` + frontend route `/`
- [ ] Postman collection imported; smoke script runs without error
