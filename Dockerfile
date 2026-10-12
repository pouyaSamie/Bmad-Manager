# Dockerfile — bmad-manager
FROM node:22-alpine AS base

ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV PRISMA_FETCH_TIMEOUT=60000
ENV PRISMA_ENGINES_CACHE_DIR=/root/.cache/prisma

# Copy local Prisma engine cache to avoid remote CDN timeouts
COPY docker/prisma-cache/ /root/.cache/prisma/

# Install pnpm and prisma globally and pre-extract engines from local cache
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@11.19.0 prisma@6.19.2 && \
    prisma -v && \
    chmod -R 777 /usr/local/lib/node_modules/prisma

# Set local prisma engine paths so prisma commands never query remote CDN or try to write to root paths
ENV PRISMA_SCHEMA_ENGINE_BINARY=/usr/local/lib/node_modules/prisma/node_modules/@prisma/engines/schema-engine-linux-musl-openssl-3.0.x
ENV PRISMA_QUERY_ENGINE_LIBRARY=/usr/local/lib/node_modules/prisma/node_modules/@prisma/engines/libquery_engine-linux-musl-openssl-3.0.x.so.node

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts \
      --network-concurrency=4 --fetch-retries=5 --fetch-retry-maxtimeout=180000

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
ARG DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ARG BETTER_AUTH_SECRET="build-time-placeholder-secret-not-used-at-runtime"
ARG BETTER_AUTH_URL="http://localhost:3000"
RUN pnpm db:generate
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/app/.next/cache \
    pnpm build

# --- Runner ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copie explicite du client Prisma genere (le tracing standalone peut manquer les chemins custom)
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
# Prisma schema + migrations for runtime migrate deploy
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["sh", "-c", "prisma migrate deploy && node server.js"]
