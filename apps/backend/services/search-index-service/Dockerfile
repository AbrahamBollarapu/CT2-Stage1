# D:/CT2/apps/backend/services/search-index-service/Dockerfile
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev

COPY server.mjs ./

ENV NODE_ENV=production
ENV PORT=8000
EXPOSE 8000
CMD ["node", "server.mjs"]
