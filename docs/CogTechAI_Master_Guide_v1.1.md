# CogTechAI — Master Guide (v1.1)

_Last updated: August 23, 2025 00:28 IST_

This master guide is a single, copy‑pasteable reference for your repo (e.g., `D:/CT2/docs/CogTechAI_Master_Guide.md`). It consolidates microservices, endpoints, gateway rules, and frontend schemas for the MVP.

---


## Scope

- 43 microservices (31 existing + 12 new)  
- Standardized REST patterns, health, telemetry, OpenAPI  
- Dev host ports (for local testing) + Traefik gateway rules  
- Frontend data schemas & integration notes

## Conventions

- All services listen on **port 8000 inside the container**.  
- In dev, selected services publish a unique **host port** (below) for direct testing.  
- In reverse‑proxy mode, access everything via **Traefik** on `http://localhost:8081` with `PathPrefix("/api/<prefix>")` and **StripPrefix**.  
- Every service exposes (not repeated below):  
  - `GET /health` → `{ status, service, time }`  
  - `GET /version` → `{ version, commit, buildTime }`  
  - `GET /openapi` → OpenAPI JSON/YAML  
  - `GET /metrics` → Prometheus

---

## 1) Services, Path Prefixes, Dev Ports, Purpose

**✅ Ports** shown are dev host ports mapped to container `8000`.  
**✅** Keep already‑confirmed mappings; the rest are proposed to cover all **43**.

| # | Service Name | Path Prefix | Dev Port | Status | Purpose |
|---:|---|---|---:|---|---|
| 1 | `esg-service` | `/api/esg` | `8007` | EXISTING | Metrics registry, lineage, evidence refs |
| 2 | `kpi-calculation-service` | `/api/kpi` | `8045` | EXISTING | Compute KPIs from metrics + factors |
| 3 | `emission-factors-service` | `/api/factors` | `8021` | EXISTING | Versioned EF/LCA libraries & lookups |
| 4 | `carbon-points-rules-service` | `/api/carbon-rules` | `8031` | EXISTING | Rule engine for scores/badges |
| 5 | `verification-service` | `/api/verification` | `8032` | EXISTING | Produce proofs for metrics/claims |
| 6 | `blockchain-service` | `/api/blockchain` | `8013` | EXISTING | Optional anchoring of digests |
| 7 | `alerts-service` | `/api/alerts` | `8034` | EXISTING | Emit alerts from DQ/risk signals |
| 8 | `notification-service` | `/api/notifications` | `8035` | EXISTING | Email/SMS/webhooks (templated) |
| 9 | `marketplace-service` | `/api/marketplace` | `8036` | EXISTING | Credits/badges modules & listings |
| 10 | `payment-service` | `/api/payments` | `8012` | EXISTING | Stripe/Razorpay webhooks, purchases |
| 11 | `wallet-service` | `/api/wallets` | `8038` | EXISTING | Balances for credits/badges |
| 12 | `supplier-service` | `/api/suppliers` | `8002` | EXISTING | Supplier master data |
| 13 | `client-service` | `/api/clients` | `8004` | EXISTING | Customer entities / legal structures |
| 14 | `org-service` | `/api/orgs` | `8003` | EXISTING | Tenants, teams, roles |
| 15 | `user-service` | `/api/users` | `8005` | EXISTING | User profiles & preferences |
| 16 | `authz-service` | `/api/iam` | `8006` | EXISTING | RBAC, API tokens, scopes |
| 17 | `facility-service` | `/api/facilities` | `8010` | EXISTING | Sites, meters, calibrations metadata |
| 18 | `device-catalog-service` | `/api/devices` | `8011` | EXISTING | Device registry & history |
| 19 | `utility-adapter-service` | `/api/utilities` | `8022` | EXISTING | Connectors (Arcadia/UtilityAPI, etc.) |
| 20 | `data-import-service` | `/api/import` | `8023` | EXISTING | Bulk CSV/XLSX import jobs |
| 21 | `file-service` | `/api/files` | `8024` | EXISTING | Attachments (legacy; superseded by evidence-store) |
| 22 | `time-series-service` | `/api/timeseries` | `8025` | EXISTING | Downsampling/rollups for telemetry |
| 23 | `search-index-service` | `/api/search` | `8026` | EXISTING | Indexed search across metrics/evidence |
| 24 | `analytics-query-service` | `/api/analytics` | `8027` | EXISTING | Ad-hoc queries & saved views |
| 25 | `dashboards-service` | `/api/dashboards` | `8028` | EXISTING | Widget/layout configs |
| 26 | `reporting-service` | `/api/reporting` | `8029` | EXISTING | Basic CSV/JSON/Excel exports |
| 27 | `jobs-service` | `/api/jobs` | `8030` | EXISTING | Async orchestration/status |
| 28 | `scheduler-service` | `/api/scheduler` | `8033` | EXISTING | Cron/recurring tasks |
| 29 | `procurement-connector-service` | `/api/procurement` | `8037` | EXISTING | Ariba/Coupa connectors |
| 30 | `api-keys-service` | `/api/api-keys` | `8001` | EXISTING | Programmatic access key mgmt |
| 31 | `data-warehouse-writer-service` | `/api/dwh` | `8039` | EXISTING | ETL to warehouse/lake |
| 32 | `ingestion-service` | `/api/ingest` | `8040` | NEW | AI/OCR ingest → evidence + metric candidates |
| 33 | `data-quality-service` | `/api/data-quality` | `8051` | NEW | Completeness/timeliness/anomaly scoring |
| 34 | `compliance-copilot-service` | `/api/copilot` | `8041` | NEW | CSRD/BRSR/ISSB drafting & review |
| 35 | `supplier-assessment-service` | `/api/supplier-assessments` | `8053` | NEW | Onboarding questionnaires & scoring |
| 36 | `materiality-service` | `/api/materiality` | `8054` | NEW | Double-materiality surveys & matrix |
| 37 | `brsr-adapter-service` | `/api/brsr` | `8042` | NEW | SEBI BRSR mapping/validation/export |
| 38 | `risk-mapping-service` | `/api/esg-risk` | `8043` | NEW | Map anomalies→ESRS topic risks |
| 39 | `report-compiler-service` | `/api/reports` | `8057` | NEW | DOCX/PDF/iXBRL + Assurance ZIP |
| 40 | `governance-service` | `/api/governance` | `8058` | NEW | Audit events, approvals, SOC/ISO banner |
| 41 | `xbrl-mapping-service` | `/api/xbrl` | `8059` | NEW | ESRS/ISSB concept maps; coverage; tag suggest |
| 42 | `device-ingest-gateway` | `/api/device-ingest` | `8044` | NEW | OPC-UA/BACnet/LoRaWAN/IoT bridges |
| 43 | `evidence-store` | `/api/evidence` | `8061` | NEW | Content-addressed registry (SHA-256) |

> **Tip:** In Compose, set Traefik labels per service (see Gateway section).

---

## 2) Endpoint Catalog (per service)

Below are core endpoints you’ll implement or keep stable. Treat them as the **public contract** for MVP v1.1.  
Notation: \* = common across services (`/health`, `/version`, `/openapi`, `/metrics`).

### Core MRV & Evidence

**esg-service** `/api/esg` (8007)  
- `GET /metrics?facility_id=&tag=` — list/filter metrics  
- `POST /metrics` — create metric (with lineage refs)  
- `GET /metrics/{id}` — read metric + lineage + evidence_refs  
- `PATCH /metrics/{id}` — update metadata/values  
- `POST /metrics/{id}/values` — append timeseries values (thin wrapper → `/api/timeseries`)  
- `GET /lineage/{metric_id}` — lineage graph

**facility-service** `/api/facilities` (8010)  
- `GET /facilities` / `POST /facilities`  
- `GET /facilities/{id}` / `PATCH /facilities/{id}`  
- `GET /facilities/{id}/meters` — attached meters  
- `POST /calibrations` — register calibration record

**time-series-service** `/api/timeseries` (8025)  
- `POST /bulk` — append batch points  
- `GET /query?metric_id=&agg=&from=&to=` — query with rollups  
- `GET /downsample?metric_id=&interval=` — pre‑computed DS

**device-ingest-gateway** `/api/device-ingest` (8044)  
- `POST /opcua/ingest`  
- `POST /bacnet/ingest`  
- `POST /lorawan/ingest`  
- `POST /aws-iot/ingest` / `POST /azure-iot/ingest`  
- `GET /mappings` — edge→metric mapping templates

**device-catalog-service** `/api/devices` (8011)  
- `GET /devices` / `POST /devices`  
- `GET /devices/{id}` / `PATCH /devices/{id}`  
- `GET /devices/{id}/calibrations`

**ingestion-service** `/api/ingest` (8040)  
- `POST /documents` — upload PDF/XLSX/CSV/EML (→ evidence + candidates)  
- `GET /jobs/{id}` — OCR/parse status  
- `GET /candidates?document_id=` — extracted metric candidates

**evidence-store** `/api/evidence` (8061)  
- `POST /` — upload evidence blob, returns `{sha256, url, metadata}`  
- `GET /{sha256}` — read metadata + retrieval URL  
- `GET /search?tag=&ref=` — search by tags/refs

**data-quality-service** `/api/data-quality` (8051)  
- `GET /heatmap?facility_id=&from=&to=` — DQ scores grid  
- `POST /anomaly/detect` — body: `{metric_id, window, method}`  
- `GET /lineage/check?metric_id=` — lineage integrity

### Disclosures (CSRD/ISSB + iXBRL)

**report-compiler-service** `/api/reports` (8057)  
- `POST /build` — body: `{ type: 'CSRD'|'ISSB'|'BRSR', period, company_id, outputs: ['pdf','ixbrl','docx','zip'] }` → job id  
- `GET /jobs/{id}` — status + artifact links  
- `GET /download?job_id=&format=ixbrl|pdf|docx|zip`  
- `GET /validation-log?job_id=` — Arelle/ESRS validation output  
- `GET /health` (already implemented)

**xbrl-mapping-service** `/api/xbrl` (8059)  
- `GET /coverage?company_id=&period=` — % mapped datapoints  
- `POST /map` — submit mapping overrides  
- `POST /tags/suggest` — suggest tags with confidence  
- `POST /validate` — run Arelle validation for a package

**brsr-adapter-service** `/api/brsr` (8042)  
- `GET /questions?version=`  
- `POST /validate` — BRSR structure checks  
- `GET /export?company_id=&period=` — BRSR CSV/pack

**verification-service** `/api/verification` (8032)  
- `POST /proofs` — generate attestations for metric/evidence  
- `GET /proofs/{id}`  
- `POST /assurance-pack` — bundle for auditor handoff

### Governance & Security

**governance-service** `/api/governance` (8058)  
- `GET /audits?entity_id=`  
- `POST /approvals` / `PATCH /approvals/{id}`  
- `GET /posture` — SOC/ISO banners & key controls

**authz-service** `/api/iam` (8006)  
- `POST /tokens` — issue API tokens (scoped)  
- `GET /permissions?user_id=`  
- `POST /roles` / `PATCH /roles/{id}`

**api-keys-service** `/api/api-keys` (8001)  
- `POST /` — create key (service/service account)  
- `GET /` — list keys (masked)  
- `DELETE /{id}` — revoke

**org-service** `/api/orgs` (8003)  
- `GET /orgs` / `POST /orgs`  
- `GET /orgs/{id}/teams`  
- `POST /orgs/{id}/members`

**user-service** `/api/users` (8005)  
- `GET /me` — profile, prefs, scopes  
- `PATCH /me`  
- `GET /users?org_id=`

**client-service** `/api/clients` (8004)  
- `GET /clients` / `POST /clients`  
- `GET /clients/{id}` / `PATCH /clients/{id}`

### Commercial

**marketplace-service** `/api/marketplace` (8036)  
- `GET /listings?type=credit|module`  
- `POST /orders`  
- `GET /orders/{id}`

**wallet-service** `/api/wallets` (8038)  
- `GET /{client_id}` — balances/history  
- `POST /credit` / `POST /debit` — recorded txns

**payment-service** `/api/payments` (8012)  
- `POST /webhooks/stripe` / `POST /webhooks/razorpay`  
- `POST /checkout` — start payment intent  
- `GET /invoices?client_id=`

### Supply, Materiality & Risk

**supplier-service** `/api/suppliers` (8002)  
- `GET /suppliers` / `POST /suppliers`  
- `GET /suppliers/{id}` / `PATCH /suppliers/{id}`  
- `POST /invites` — onboarding links

**supplier-assessment-service** `/api/supplier-assessments` (8053)  
- `POST /assessments` — start questionnaire  
- `GET /assessments/{id}` — status & score  
- `POST /assessments/{id}/submit`  
- `GET /assessments/{id}/risk-score`

**procurement-connector-service** `/api/procurement` (8037)  
- `POST /ariba/invite` / `POST /coupa/invite`  
- `GET /status/{external_id}`

**materiality-service** `/api/materiality` (8054)  
- `POST /surveys` — create stakeholder survey  
- `GET /surveys/{id}/responses`  
- `GET /matrix?company_id=&period=` — 2‑axis matrix

**risk-mapping-service** `/api/esg-risk` (8043)  
- `GET /topics` — ESRS topics  
- `POST /predict` — map anomalies to risks  
- `GET /mitigations?topic=`

### Analytics & Ops

**analytics-query-service** `/api/analytics` (8027)  
- `POST /query` — SQL/DSL with guardrails  
- `POST /saved` / `GET /saved/{id}`

**dashboards-service** `/api/dashboards` (8028)  
- `GET /configs?user_id=`  
- `POST /configs` — layout JSON  
- `GET /widgets` — widget registry

**search-index-service** `/api/search` (8026)  
- `GET /?q=&type=metric|evidence|supplier`  
- `POST /reindex` — job

**jobs-service** `/api/jobs` (8030)  
- `GET /{id}` — status, logs, artifacts  
- `POST /cancel/{id}`

**scheduler-service** `/api/scheduler` (8033)  
- `POST /schedules` — cron expr + target  
- `GET /schedules/{id}`  
- `DELETE /schedules/{id}`

**reporting-service** `/api/reporting` (8029)  
- `POST /export` — CSV/JSON/Excel  
- `GET /exports/{id}` — link

**data-import-service** `/api/import` (8023)  
- `POST /jobs` — legacy bulk import  
- `GET /jobs/{id}`

**data-warehouse-writer-service** `/api/dwh` (8039)  
- `POST /exports` — batch to lake/warehouse  
- `GET /exports/{id}`

**utility-adapter-service** `/api/utilities` (8022)  
- `POST /providers/{name}/auth`  
- `POST /providers/{name}/pull` — bill/interval data  
- `GET /providers` — supported list

**emission-factors-service** `/api/factors` (8021)  
- `GET /libraries?region=&year=`  
- `GET /factors?code=&activity=`  
- `POST /overrides`

**blockchain-service** `/api/blockchain` (8013)  
- `POST /anchor` — batch/evidence digest  
- `GET /anchor/{id}`

**alerts-service** `/api/alerts` (8034)  
- `GET /?entity_id=&state=open|acked`  
- `POST /ack/{id}`

**notification-service** `/api/notifications` (8035)  
- `POST /send` — email/SMS/webhook  
- `POST /templates` / `GET /templates`

**compliance-copilot-service** `/api/copilot` (8041)  
- `POST /draft` — section draft from evidence  
- `POST /review` — redlines with citations  
- `POST /ask` — Q&A with traceability

---

## 3) Gateway & Routing (Traefik)

**Global**  
- Dashboard: `http://localhost:8080`  
- Public entrypoint (dev): `:8081` → `web`

**Per service (example: esg-service)**

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.docker.network=ct2-net"
  - "traefik.http.routers.esg-service.entrypoints=web"
  - "traefik.http.routers.esg-service.rule=PathPrefix(`/api/esg`)"
  - "traefik.http.middlewares.strip-esg-service.stripprefix.prefixes=/api/esg"
  - "traefik.http.routers.esg-service.middlewares=strip-esg-service"
  - "traefik.http.services.esg-service.loadbalancer.server.port=8000"
```

**Health quick‑check (via gateway)**  
- `GET http://localhost:8081/api/reports/health` → ✅ (already working)  
- `GET http://localhost:8081/api/esg/health` → ensure router label + middleware applied

---

## 4) Frontend Schema (Landing & App)

### UI Pages (minimal Google‑style)

- `/` **Landing**  
  - **HeroSearch** → calls `/api/search?q=`  
  - **TrustStrip** → pulls:  
    - `/api/reports/validation-log?job_id=…`  
    - `/api/xbrl/coverage?company_id=…&period=…`  
  - **Live Status Grid** → probes `/health` of key services via gateway  
  - **Call‑to‑Action** → `/signup` (user/org flow)
- `/status` Platform status (per service)  
- `/reports` Build/download flows (compiler + xbrl)  
- `/materiality` Surveys & matrix  
- `/suppliers` Onboarding assessments  
- `/dashboards` Widgets + analytics

### TypeScript Domain Models (excerpt)

```ts
// Common
export interface Health { status: 'ok'|'degraded'|'down'; service: string; time: string; }
export interface Page<T> { items: T[]; next?: string; total?: number; }

// ESG & Timeseries
export interface Metric { id: string; name: string; unit: string; tags?: string[]; lineage?: string[]; evidence_refs?: string[]; }
export interface Point { t: string; v: number; }
export interface QueryParams { metric_id: string; agg?: 'avg'|'sum'|'min'|'max'; from: string; to: string; }

// Reporting & XBRL
export interface ReportJobReq { type: 'CSRD'|'ISSB'|'BRSR'; period: string; company_id: string; outputs: ('pdf'|'ixbrl'|'docx'|'zip')[]; }
export interface ReportJob { id: string; status: 'queued'|'running'|'done'|'error'; artifacts?: { format: string; url: string; }[]; }
export interface XbrlCoverage { company_id: string; period: string; coverage_pct: number; missing: string[]; }

// DQ & Risk
export interface DqHeatCell { metric_id: string; score: number; dims: Record<string,string>; }
export interface RiskPredictReq { anomalies: { metric_id: string; window: string; }[]; }
export interface RiskMapping { topic: string; likelihood: number; impact: number; mitigations: string[]; }

// Suppliers & Materiality
export interface Supplier { id: string; name: string; status: 'invited'|'active'; }
export interface Assessment { id: string; supplier_id: string; score?: number; state: string; }
export interface MaterialityMatrix { xAxis: string[]; yAxis: string[]; values: number[][]; }
```

### API Client (fetch wrapper)

```ts
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${process.env.NEXT_PUBLIC_API}${path}`, {
    ...init,
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${getToken()}`, ...(init?.headers||{}) }
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.headers.get('content-type')?.includes('application/json') ? r.json() : (await r.text() as any);
}
// .env.local: NEXT_PUBLIC_API=http://localhost:8081
```

### Landing wiring (examples)

```ts
// TrustStrip
const cov = await api<XbrlCoverage>('/api/xbrl/coverage?company_id=ACME&period=FY2024');
const badge = cov.coverage_pct >= 95 ? '5/5 Disclosures' : 'In Progress';

// Status Grid
const services = ['/api/reports/health','/api/esg/health','/api/xbrl/health','/api/data-quality/health','/api/kpi/health'];
const checks = await Promise.allSettled(services.map(p => api<Health>(p)));
```

### State & Telemetry

- **Auth:** JWT from `authz-service` (`/api/iam/tokens`) stored in httpOnly cookie  
- **Observability:** `GET /metrics` (Prometheus) + distributed trace id header (`X-Trace-Id`)  
- **Pagination:** `Page<T>` pattern with `?cursor=`

---

## 5) Development Standards

- **Versioning:** semantic routes where needed, e.g., `/api/esg/v1/...` once stable  
- **Errors:** RFC 7807 Problem+JSON `{ type, title, status, detail, instance }`  
- **Idempotency:** `Idempotency-Key` header for `POST /build`, `/exports`, `/anchor`, etc.  
- **Security:** all write ops require JWT with scopes (e.g., `scope:reports:build`)  
- **Docs:** each service serves `/openapi` and is aggregated in a docs site  
- **Jobs:** long‑running ops → `jobs-service`, return `202 + {job_id}`  
- **Evidence links:** every numeric fact in iXBRL must have a clickable evidence link → `/api/evidence/{sha256}`

---

## 6) Quick Compose Label Template

Replace `<name>` and `<prefix>` per row in the table.

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.docker.network=ct2-net"
  - "traefik.http.routers.<name>.entrypoints=web"
  - "traefik.http.routers.<name>.rule=PathPrefix(`/api/<prefix>`)"
  - "traefik.http.middlewares.strip-<name>.stripprefix.prefixes=/api/<prefix>"
  - "traefik.http.routers.<name>.middlewares=strip-<name>"
  - "traefik.http.services.<name>.loadbalancer.server.port=8000"
```

---

## What to pin on your wall (TL;DR)

- **Gateway:** `http://localhost:8081/api/...` with **StripPrefix**  
- **iXBRL 5/5 badge pulls from:**  
  - `/api/xbrl/coverage` (≥95%)  
  - `/api/reports/validation-log` (0 Arelle errors)  
- **Evidence links:** `/api/evidence/{sha256}`

**Core hero demo:**  
1. Upload bill → `/api/ingest/documents`  
2. Metrics & timeseries appear → `/api/esg`, `/api/timeseries/query`  
3. DQ heatmap green → `/api/data-quality/heatmap`  
4. Build iXBRL → `/api/reports/build` → `/api/reports/download?format=ixbrl`

---

**Appendix**  
If you need this as a PDF or want OpenAPI stubs per service (ready to paste into each `/openapi/openapi.yaml`), let me know and I can generate them from this source.
