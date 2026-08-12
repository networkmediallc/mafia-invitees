FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts

COPY . .

ARG DATABASE_URL="file:/tmp/build.db"
ARG SESSION_SECRET="build-only-secret"
ARG APP_PASSWORD="build-only-password"
ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=$DATABASE_URL \
    SESSION_SECRET=$SESSION_SECRET \
    APP_PASSWORD=$APP_PASSWORD

RUN npx prisma generate && npm run build \
  && npm prune --omit=dev

# Do not bake build-only DB/secrets into runtime — Railway provides real values
ENV DATABASE_URL= \
    SESSION_SECRET= \
    APP_PASSWORD= \
    NODE_ENV=production

EXPOSE 3000

CMD ["sh", "-c", "echo \"Starting on PORT=${PORT:-3000} volume=${RAILWAY_VOLUME_MOUNT_PATH:-none} db=${DATABASE_URL:-auto}\" && npx prisma migrate deploy && exec npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
