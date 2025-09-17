FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev || npm install --omit=dev
COPY server.mjs ./
EXPOSE 8000
CMD ["node","server.mjs"]
