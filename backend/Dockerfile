FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/src ./src
COPY backend/scripts ./scripts
COPY frontend /frontend
COPY database/migrations /database/migrations

EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm start"]
