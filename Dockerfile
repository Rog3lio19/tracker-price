# Una sola imagen, un solo contenedor: aplica migraciones y corre la web (Nitro)
# y el worker (precios + bot de Telegram) juntos con scripts/start.mjs.
# La base SQLite vive en /data: monta ahí un volumen persistente.
FROM node:24-slim AS base
RUN npm install -g pnpm@10.27.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Solo dependencias de producción: el worker y el migrador corren con tsx desde src/
FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

FROM node:24-slim AS runtime
ENV NODE_ENV=production \
	DATABASE_URL=/data/tracker.db \
	HOST=0.0.0.0 \
	PORT=3000
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.output ./.output
COPY --chown=node:node package.json tsconfig.json ./
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node src ./src
# Un volumen montado en /data hereda este dueño la primera vez
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "scripts/start.mjs"]
