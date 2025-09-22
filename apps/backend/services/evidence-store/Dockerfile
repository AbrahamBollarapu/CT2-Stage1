# D:/CT2/apps/backend/services/evidence-store/Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev

COPY server.mjs ./

ENV NODE_ENV=production
ENV PORT=8000
ENV EVIDENCE_DIR=/data/evidence

RUN mkdir -p $EVIDENCE_DIR
EXPOSE 8000
CMD ["node", "server.mjs"]
