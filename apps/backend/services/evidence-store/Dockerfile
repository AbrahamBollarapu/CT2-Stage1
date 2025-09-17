FROM node:20-alpine

WORKDIR /app/services/evidence-store

# deps
COPY services/evidence-store/package*.json ./
RUN if [ -f package-lock.json ]; then (npm install --omit=dev --no-audit --no-fund || npm install --no-audit --no-fund); else npm install --no-audit --no-fund; fi

# shared tracing helpers (import via ../_shared/…)
COPY _shared /app/_shared

# app code
COPY services/evidence-store/ .

ENV NODE_ENV=production \
    PORT=8000 \
    EVIDENCE_DIR=/evidence

EXPOSE 8000
CMD ["node","server.js"]
