FROM node:20-alpine
WORKDIR /app

# Always copy from the subfolder so context mistakes don’t bite us
COPY services/supplier-service/package*.json ./
RUN npm install --omit=dev || npm install --omit=dev

COPY services/supplier-service/server.mjs ./

EXPOSE 8000
CMD ["node", "/app/server.mjs"]
