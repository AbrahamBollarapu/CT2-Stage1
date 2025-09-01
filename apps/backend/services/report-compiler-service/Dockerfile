# syntax=docker/dockerfile:1

############################
# Build stage
############################
FROM node:20-alpine AS build
WORKDIR /app

# Install deps (handle both npm ci and npm i gracefully)
COPY package*.json ./
RUN if [ -f package-lock.json ]; then (npm ci --no-audit --no-fund || npm i --no-audit --no-fund); else npm i --no-audit --no-fund; fi

# Build TS
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

############################
# Runtime stage
############################
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# tini for proper signal handling (stops SIGTERM-related restarts)
RUN apk add --no-cache tini wget

# Prod deps only
COPY --from=build /app/package*.json ./
RUN if [ -f package-lock.json ]; then (npm ci --omit=dev --no-audit --no-fund || npm i --omit=dev --no-audit --no-fund); else npm i --omit=dev --no-audit --no-fund; fi

# Copy built app
COPY --from=build /app/dist ./dist

EXPOSE 8000

# Robust healthcheck (IPv4)
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -4 -qO- http://127.0.0.1:8000/ready || exit 1

ENTRYPOINT ["/sbin/tini","-g","--"]
CMD ["node","dist/index.js"]
