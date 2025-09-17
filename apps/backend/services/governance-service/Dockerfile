# --- deps stage ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN if [ -f package-lock.json ]; then if [ -f package-lock.json ]; then npm ci --no-audit --fund=false; else npm install --no-audit --fund=false; fi --no-audit --fund=false; else npm install --no-audit --fund=false; fi

# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime stage ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/dist ./dist
# install only prod deps for runtime (optional if none needed)
RUN [ -f package-lock.json ] && if [ -f package-lock.json ]; then npm install --omit=dev --no-audit --fund=false; else npm install --omit=dev --no-audit --fund=false; fi --omit=dev --no-audit --no-fund || true
EXPOSE 8000
CMD ["node","dist/server.js"]


