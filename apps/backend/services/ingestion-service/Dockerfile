FROM node:20-alpine

WORKDIR /app/services/ingestion-service

# Install production deps (robust with/without lockfile)
COPY services/ingestion-service/package*.json ./
RUN if [ -f package-lock.json ]; then (npm install --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund); else npm install --omit=dev --no-audit --no-fund; fi

# Shared tracing helpers (resolve via ../_shared/...)
COPY _shared /app/_shared

# App sources
COPY services/ingestion-service/ .

ENV NODE_ENV=production \
    PORT=8000 \
    EVIDENCE_DIR=/evidence

EXPOSE 8000
CMD ["node","server.js"]
