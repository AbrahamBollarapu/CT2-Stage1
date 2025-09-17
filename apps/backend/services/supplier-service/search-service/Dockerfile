# apps/backend/services/search-service/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then (npm ci --no-audit --no-fund || npm install); else npm install; fi
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
RUN if [ -f package-lock.json ]; then (npm install --omit=dev --no-audit --no-fund || npm install --omit=dev); else npm install --omit=dev; fi
COPY --from=build /app/dist ./dist
EXPOSE 8000
CMD ["node", "dist/index.js"]
