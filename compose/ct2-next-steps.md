
# CogTechAI — MVP Smoke Test & Next Steps (no-JWT)

_Last updated: 2025-09-12 18:37 IST_

## How to run the smoke test

1. Ensure Traefik and Day-1/Day-2 services are up:
   ```pwsh
   docker compose -f docker-compose.yml -f docker-compose.traefik.yml -f docker-compose.days1-4.yml -f docker-compose.routers.yml up -d --profile day1 --profile day2
   ```
2. Run the script:
   ```pwsh
   PowerShell -ExecutionPolicy Bypass -File .\ct2-smoketest.ps1
   ```
3. Expected outcome: all checks `Ok = True` and a ZIP saved to `D:\CT2\out\report-2024-Q4.zip`.

---

## S1 Polish (finish line)

### 1) Evidence streaming + content headers
**Endpoints**
- `POST /api/evidence/items` → returns `{ id, sha256, size, contentType, createdAt }`
- `GET  /api/evidence/items/{{id}}` → JSON metadata
- `GET  /api/evidence/content/{{id}}` → streams binary (sets `Content-Type`, `Content-Length`, `ETag`, `X-Content-SHA256`)
- `HEAD /api/evidence/content/{{id}}` → headers only

**Notes**
- Accept `{ org_id, contentType, data(base64)|url, meta{{...}} }`
- Persist SHA-256, size; reject duplicates on same `org_id + sha256` (409 with existing id)
- Feature flag: `EVIDENCE_INDEX_ON_INGEST=true`

**Acceptance**
- Upload 1KB text → GET content matches; headers present; duplicate returns 409 (id points to original).

### 2) Search indexing hooks
**Events that must index:**
- Evidence ingest (type=`evidence`, fields: `id, org_id, sha256, size, tags, createdAt`)
- Report build done (type=`report`, fields: `artifact_id, org_id, period, summary, coverage_score`)

**Contract to search-index-service**
- `POST /api/search/index`
  ```json
  {"type":"evidence","id":"...","org_id":"demo","text":"...","tags":["..."],"createdAt":"..."}
  ```

**Env**
- `SEARCH_INDEX_URL=http://search-index-service:8000`

**Acceptance**
- After ingest/build, a subsequent search query returns the new record within 3s.

### 3) Ingestion QA
- Ensure `/api/time-series/points` is the only write path; respond with a normalized summary:
  ```json
  {"ok":true,"upserted":2,"window":{"from":"2024-10-01","to":"2024-12-31"}}
  ```
- Return 400 with field errors (missing meter/unit/points).

---

## S2 Day-wise Build (no-JWT, Days 4–10)

> Keep using `x-api-key` + `org_id` checks. Add feature flags where useful.

### Day 4 — Suppliers & Assessments (MVP skeleton)
**DB**
- `suppliers(id, org_id, name, type, status, created_at)`
- `assessments(id, org_id, name, version, questions(jsonb), created_at)`
- `supplier_assessments(id, supplier_id, assessment_id, status, score)`

**API**
- `POST/GET /api/suppliers`
- `POST/GET /api/assessments`
- `POST   /api/suppliers/{id}/assign-assessment/{assessment_id}`
- `POST   /api/suppliers/{id}/responses` (stores answers, computes score)

**Acceptance**
- Create supplier → assign assessment → submit responses → computed score stored and retrievable.

### Day 5 — Materiality & Risk
**DB**
- `material_topics(id, org_id, code, name, weight)`
- `risk_register(id, org_id, title, topic_code, likelihood, impact, score)`

**API**
- `GET/POST /api/materiality/topics`
- `GET/POST /api/risks` (auto `score = likelihood * impact * topic.weight`)

**Acceptance**
- Create 3 topics, 5 risks → `/api/risks?sort=score&desc=true` ranks correctly.

### Day 6 — Governance workflow
**DB**
- `policies(id, org_id, name, version, owner, status)`
- `approvals(id, org_id, entity_type, entity_id, step, actor, status)`

**API**
- `POST /api/policies` | `POST /api/policies/{id}/submit`
- `POST /api/approvals/{entity_type}/{id}/advance`

**Acceptance**
- Submit policy → two-step approval → status transitions `{draft→in_review→approved}` logged.

### Day 7 — Alerts → Notifications
**API**
- `POST /api/alerts/emit` (rule_id, severity, message, subject, org_id)
- `POST /api/notifications/send` (email|sms, to, subject, body)
- Background: alerts-service posts to notification-service via internal API (dev key).

**Acceptance**
- Emitting `severity=high` triggers email log record in DB (delivery mocked, logged).

### Day 8 — Connectors & CSV import
**API**
- `POST /api/ingest/csv` (accepts upload; maps columns → TS writes)
- Stub external providers: `{provider:"mock_discom"}`

**Acceptance**
- CSV with two rows creates two TS points; 400 on bad unit; summary returned.

### Day 9 — Device gateway → TS
**API**
- `POST /api/devices/ingest` (device_id, ts, metric, value, unit)
- Optional MQTT listener in dev; HTTP only for MVP.

**Acceptance**
- Three device posts appear in `/api/time-series/points` range within 1s.

### Day 10 — Exports, Dashboards, Observability/Backups
**Exports API**
- `GET /api/reports/export/pdf?artifact_id=...`
- `GET /api/reports/export/xlsx?artifact_id=...`

**Dashboards**
- Tiles for: Ingest volume, DQ pass rate, KPI energy, Alerts 24h

**Ops**
- Enable structured logs; add backup cron for Postgres volumes; basic OpenTelemetry traces at gateway.

**Acceptance**
- PDF/XLSX endpoints return 200; dashboard tiles load; daily backup file appears in backup path.

---

## S3 (post-MVP flagged stubs)
- Marketplace/Wallet (fake endpoints with toggles)
- Verification “Assurance ZIP” skeleton (bundle evidence + coverage JSON)
- Blockchain Anchor (DEV-only: hash & store locally; print txn-like id)
- Scheduler UI stubs; Procurement config; BRSR export stub; Copilot panel

---

## Known tips
- After router label changes: `docker compose ... up -d --force-recreate traefik`
- If hot copying files into a container, ensure writable mounts; then `docker restart <svc>`
- The deprecated `version:` key in compose files is harmless; safe to remove.
