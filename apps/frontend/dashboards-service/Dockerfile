FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server.mjs .
ENV PORT=8000
CMD ["npm","run","start:prod"]
