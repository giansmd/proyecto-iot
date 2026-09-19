# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
RUN pnpm install --frozen-lockfile --filter @iot/backend...

COPY packages/shared packages/shared
COPY apps/backend apps/backend

RUN pnpm --filter @iot/shared build \
 && pnpm --filter @iot/backend build \
 && pnpm --filter @iot/backend deploy --prod --legacy /out

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build --chown=app:app /out ./
USER app
EXPOSE 5000
CMD ["sh", "-c", "node dist/infrastructure/persistence/migrate.js && node dist/main.js"]
