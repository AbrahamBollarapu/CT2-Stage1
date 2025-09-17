FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --only=production
COPY . .
RUN mkdir -p evidence
EXPOSE 8000
CMD ["npm", "run", "start:prod"]