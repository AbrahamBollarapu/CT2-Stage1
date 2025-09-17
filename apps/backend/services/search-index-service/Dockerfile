FROM node:20-alpine

WORKDIR /app/services/search-index-service

COPY services/search-index-service/package*.json ./
RUN if [ -f package-lock.json ]; then (npm install --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund); else npm install --omit=dev --no-audit --no-fund; fi

COPY _shared /app/_shared
COPY services/search-index-service/ .

ENV NODE_ENV=production \
    PORT=8000

EXPOSE 8000
CMD ["node","server.js"]
