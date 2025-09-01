# blockchain-service

Minimal, cycle-free Fastify service (ESM) with precompiled TypeScript.

## Scripts
- `npm run dev`    – local dev with TSX
- `npm run build`  – compile to `dist/`
- `npm start`      – run compiled server

## Environment
- `PORT` (default 8000)
- `HOST` (default 0.0.0.0)
- `SERVICE_NAME` (default "blockchain-service")

## Health
- `GET /health` → `{ "status": "ok" }`
