# syntax=docker/dockerfile:1.7

# ─── Build stage ────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps using the lockfile only — no source yet so this layer is reused
# across code-only changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json vite.config.ts tailwind.config.js postcss.config.js ./
COPY src ./src
COPY migrations ./migrations
RUN npm run build

# Drop dev deps from the install we just did. Smaller node_modules to copy.
RUN npm prune --omit=dev

# ─── Runtime stage ──────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# wget is in the busybox shipped with alpine — used by the healthcheck.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/package.json ./package.json

USER node
EXPOSE 3010

# Run migrations before booting. The migration runner is idempotent, so this
# is safe on every container start.
CMD ["sh", "-c", "node --enable-source-maps dist/server/db/migrate.js && node --enable-source-maps dist/server/index.js"]
