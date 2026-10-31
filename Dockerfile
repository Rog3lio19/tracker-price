# Una sola imagen para los tres servicios de docker-compose.yml:
# migrate (aplica migraciones), web (Nitro) y worker (precios + bot de Telegram)
FROM node:24-slim AS base
RUN npm install -g pnpm@10.27.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
	pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

# El worker y el migrador corren con tsx desde src/, así que se queda todo node_modules
FROM base AS runtime
ENV NODE_ENV=production \
	DATABASE_URL=/data/tracker.db \
	HOST=0.0.0.0 \
	PORT=3000
COPY --from=build --chown=node:node /app /app
# El volumen nombrado hereda el dueño de este directorio la primera vez
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
