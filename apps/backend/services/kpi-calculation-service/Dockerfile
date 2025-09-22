FROM node:20-alpine

WORKDIR /app

# Install deps (none required, but keep pattern for lockfile if present)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev

# App code
COPY server.mjs ./

# Default envs — override via compose if you like
ENV PORT=8000 \
    PREFIX=/api/time-series \
    AUTH_MODE=dev \
    DEV_KEY=ct2-dev-key

EXPOSE 8000
CMD ["node", "server.mjs"]
