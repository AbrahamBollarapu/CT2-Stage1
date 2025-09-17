# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# add script "start:prod" in package.json if missing → "node server.mjs"
EXPOSE 8000
CMD ["npm","run","start:prod"]
