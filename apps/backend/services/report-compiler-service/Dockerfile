FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY server.mjs ./server.mjs
RUN mkdir -p /app/assets/fallbacks
COPY assets/fallbacks/truststrip.pdf /app/assets/fallbacks/truststrip.pdf

ENV PORT=8000
ENV ARTIFACT_DIR=/data/artifacts
RUN mkdir -p "$ARTIFACT_DIR"

EXPOSE 8000
CMD ["npm","start"]
