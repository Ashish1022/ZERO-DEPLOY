# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api-server/package.json            apps/api-server/
COPY packages/database/package.json          packages/database/
COPY packages/typescript-config/package.json packages/typescript-config/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @zero-deploy/api-server...

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=9000

COPY --from=deps /app ./
COPY packages/database packages/database
COPY apps/api-server   apps/api-server

EXPOSE 9000
WORKDIR /app/apps/api-server
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
