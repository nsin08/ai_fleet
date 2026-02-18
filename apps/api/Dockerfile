FROM node:20-alpine AS base
WORKDIR /app

# ── Install dependencies ────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/domain/package.json ./packages/domain/
COPY packages/adapters/package.json ./packages/adapters/
COPY apps/api/package.json ./apps/api/
RUN npm ci --workspace=packages/domain --workspace=packages/adapters --workspace=apps/api

# ── Build ───────────────────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.base.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN npm run build --workspace=packages/domain \
 && npm run build --workspace=packages/adapters \
 && npm run build --workspace=apps/api

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=build /app/packages/domain/dist ./packages/domain/dist
COPY --from=build /app/packages/adapters/dist ./packages/adapters/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/domain/node_modules ./packages/domain/node_modules
COPY --from=deps /app/packages/adapters/node_modules ./packages/adapters/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]
