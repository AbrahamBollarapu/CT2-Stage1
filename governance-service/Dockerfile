# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# Use install (not ci) so we don't require a lockfile
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8000
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 8000
CMD ["node", "dist/server.js"]

