FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm i --omit=dev
COPY server.mjs ./server.mjs
EXPOSE 8000
CMD ["node","server.mjs"]
