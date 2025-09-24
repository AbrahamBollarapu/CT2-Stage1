FROM node:20-alpine
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci --omit=dev || npm i --omit=dev

# Copy ONLY the file we want to run
COPY server.mjs ./

EXPOSE 8001
CMD ["node","server.mjs"]
