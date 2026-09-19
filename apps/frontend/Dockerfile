# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/frontend/package.json apps/frontend/
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile --filter @iot/frontend...

COPY packages/shared packages/shared
COPY apps/frontend apps/frontend

RUN pnpm --filter @iot/shared build \
 && pnpm --filter @iot/frontend build

FROM nginx:1.27-alpine AS runtime
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
