# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# 1) Copy only manifests first (better cache)
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# 2) Copy the app (ensure .dockerignore doesn't drop server.mjs)
COPY . .

ENV NODE_ENV=production
ENV PORT=8000

CMD ["node","server.mjs"]
