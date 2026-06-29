# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/zero/package.json                    apps/zero/
COPY packages/database/package.json            packages/database/
COPY packages/typescript-config/package.json   packages/typescript-config/
COPY packages/trpc/package.json                packages/trpc/
COPY packages/ui/package.json                  packages/ui/
COPY packages/auth/package.json                packages/auth/
COPY packages/redis/package.json               packages/redis/
COPY packages/eslint-config/package.json       packages/eslint-config/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @zero-deploy/zero...

FROM base AS builder
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy all node_modules from deps
COPY --from=deps /app/node_modules                        ./node_modules
COPY --from=deps /app/apps/zero/node_modules              ./apps/zero/node_modules
COPY --from=deps /app/packages/database/node_modules      ./packages/database/node_modules
COPY --from=deps /app/packages/trpc/node_modules          ./packages/trpc/node_modules
COPY --from=deps /app/packages/ui/node_modules            ./packages/ui/node_modules
COPY --from=deps /app/packages/auth/node_modules          ./packages/auth/node_modules
COPY --from=deps /app/packages/redis/node_modules         ./packages/redis/node_modules

# Copy source
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/typescript-config  packages/typescript-config
COPY packages/database           packages/database
COPY packages/trpc               packages/trpc
COPY packages/ui                 packages/ui
COPY packages/auth               packages/auth
COPY packages/redis              packages/redis
COPY packages/eslint-config      packages/eslint-config
COPY apps/zero                   apps/zero

WORKDIR /app/apps/zero
RUN pnpm exec next build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/zero/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/zero/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/zero/.next/static ./apps/zero/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/zero/server.js"]