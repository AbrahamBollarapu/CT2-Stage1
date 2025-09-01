# CogTechAI — MVP Staging (S1 investor demo → S2 private beta → S3 complete MVP)

This doc mirrors our 3-stage plan. S1: steel-thread ingest→evidence→metrics→DQ→iXBRL with polished landing. S2: onboarding, governance, surveys, real pipes. S3: marketplace/payments, verification/anchor, scheduler, copilot.

- Dashboard entrypoint: Traefik web on :8081 (adjust if your setup differs)
- Health wall endpoints (S1): /api/reports/health, /api/esg/health, /api/xbrl/health, /api/data-quality/health, /api/kpi/health, /api/ingest/health, /api/evidence/health, /api/timeseries/health
