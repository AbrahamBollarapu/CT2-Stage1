FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# Prefer deterministic install; if npm ci fails or no lockfile, fall back to npm install
RUN if [ -f package-lock.json ]; then (npm ci --no-audit --no-fund || npm install --no-audit --no-fund); else npm install --no-audit --no-fund; fi
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Use the (possibly updated) lockfile from build stage for consistency
COPY --from=build /app/package*.json ./
# Prod deps only; tolerant of lockfile mismatch
RUN if [ -f package-lock.json ]; then (npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund); else npm install --omit=dev --no-audit --no-fund; fi
COPY --from=build /app/dist ./dist
CMD ["node","dist/index.js"]