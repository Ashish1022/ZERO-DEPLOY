# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/s3-reverse-proxy-server/package.json apps/s3-reverse-proxy-server/
COPY packages/database/package.json            packages/database/
COPY packages/typescript-config/package.json   packages/typescript-config/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @zero-deploy/s3-reverse-proxy-server...

FROM base AS runner
ENV NODE_ENV=production
ENV S3_PROXY_PORT=8000

COPY --from=deps /app ./
COPY packages/database              packages/database
COPY apps/s3-reverse-proxy-server   apps/s3-reverse-proxy-server

EXPOSE 8000
WORKDIR /app/apps/s3-reverse-proxy-server
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
