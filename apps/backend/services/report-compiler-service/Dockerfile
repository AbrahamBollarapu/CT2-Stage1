# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app

# Install deps (robust if no package-lock.json)
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy source
COPY . .

# Ensure the server binds 0.0.0.0:8000
EXPOSE 8000

# Adjust entry if not server.mjs (server.js / dist/server.js)
CMD ["node","server.mjs"]
