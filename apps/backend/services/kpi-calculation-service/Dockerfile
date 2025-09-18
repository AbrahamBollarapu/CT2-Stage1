# D:/CT2/apps/backend/services/kpi-calculation-service/Dockerfile
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev

COPY server.mjs ./

ENV NODE_ENV=production
ENV PORT=8000
ENV DEMO_API_KEY=ct2-dev-key
ENV GW_BASE=http://traefik:80

EXPOSE 8000
CMD ["node", "server.mjs"]
