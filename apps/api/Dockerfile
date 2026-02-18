FROM node:20-alpine AS base
WORKDIR /app

# ── Install dependencies ────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/domain/package.json ./packages/domain/
COPY packages/adapters/package.json ./packages/adapters/
COPY apps/api/package.json ./apps/api/
RUN npm install --workspace=packages/domain --workspace=packages/adapters --workspace=apps/api

# ── Build ───────────────────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.base.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN npm run build --workspace=packages/domain || true
RUN npm run build --workspace=packages/adapters || true
RUN npm run build --workspace=apps/api || true

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]
