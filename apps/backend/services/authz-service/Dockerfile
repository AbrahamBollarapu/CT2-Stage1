# Multi-stage build that doesn't require a package-lock.json
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY .npmrc ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/.npmrc ./
# Reuse built node_modules from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 8000
CMD ["node","dist/server.js"]



