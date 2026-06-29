# syntax=docker/dockerfile:1 

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api-server/package.json             apps/api-server/
COPY packages/database/package.json           packages/database/
COPY packages/typescript-config/package.json  packages/typescript-config/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @zero-deploy/api-server...

FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps /app/node_modules                    ./node_modules
COPY --from=deps /app/apps/api-server/node_modules    ./apps/api-server/node_modules
COPY --from=deps /app/packages/database/node_modules  ./packages/database/node_modules

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/typescript-config  packages/typescript-config
COPY packages/database           packages/database
COPY apps/api-server             apps/api-server

EXPOSE 8000
WORKDIR /app/apps/api-server
CMD ["pnpm", "exec", "tsx", "src/index.ts"]