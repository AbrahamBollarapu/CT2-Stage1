FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm i --omit=dev

COPY app ./app

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:8001/health || exit 1

CMD ["node", "app/server.mjs"]

