FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=8787 DATABASE_PATH=/data/masterclass.db
VOLUME ["/data"]
EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]
