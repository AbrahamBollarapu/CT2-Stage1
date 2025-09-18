# D:/CT2/apps/backend/services/jobs-service/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev

COPY server.mjs ./server.mjs

ENV PORT=8000
CMD ["npm","run","start:prod"]
