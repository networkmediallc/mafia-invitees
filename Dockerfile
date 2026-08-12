FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
# Skip postinstall (prisma generate) until the schema is copied in
RUN npm ci --include=dev --ignore-scripts

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="file:/tmp/build.db" \
    SESSION_SECRET="build-only-secret" \
    APP_PASSWORD="build-only-password"

RUN npx prisma generate && npm run build \
  && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
