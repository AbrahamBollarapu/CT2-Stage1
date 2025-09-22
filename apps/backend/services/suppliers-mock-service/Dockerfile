FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev
COPY . .
ENV PORT=8000
CMD ["node","server.mjs"]
