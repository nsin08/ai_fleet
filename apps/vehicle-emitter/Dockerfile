FROM node:20-alpine AS base
WORKDIR /app

FROM base AS build
COPY package.json tsconfig.json ./
COPY src/ ./src/
RUN npm install && npm run build

FROM base AS runtime
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

ENV NODE_ENV=production
CMD ["node", "dist/emitter.js"]
