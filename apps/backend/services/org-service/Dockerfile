FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --no-fund --no-audit
COPY . .
EXPOSE 8000
CMD ["node","--loader","ts-node/esm","src/server.ts"]

