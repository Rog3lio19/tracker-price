# Tracker Price

Rastreador de precios para Amazon MX y Mercado Libre con alertas por Telegram.

**Stack:** TanStack Start · Drizzle ORM · SQLite (better-sqlite3) · shadcn/ui · Tailwind v4 · paleta Tokyo Night

## Desarrollo

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate      # crea data/tracker.db y aplica migraciones
pnpm dev             # http://localhost:3000
```

## Docker

```bash
cp .env.example .env         # llena las variables que necesites
docker compose up -d --build # http://localhost:3000
docker compose logs -f worker
```

`docker-compose.yml` levanta tres servicios con la misma imagen:

| Servicio | Qué hace |
|---|---|
| `migrate` | Aplica las migraciones pendientes y termina |
| `web` | Dashboard (build de Nitro) en el puerto `3000` (o `PORT`) |
| `worker` | Revisa los precios y atiende el bot de Telegram |

La base SQLite vive en el volumen `tracker-data` (`/data/tracker.db`), compartido entre `web` y `worker`.

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción (Nitro, Node) en `.output/` |
| `pnpm db:generate` | Genera una migración a partir de cambios en `src/db/schema.ts` |
| `pnpm db:migrate` | Aplica migraciones pendientes |
| `pnpm db:studio` | Explorador visual de la DB |
| `pnpm worker` | Revisa los precios en segundo plano (cada producto según su intervalo) |
| `pnpm scrape <url>` | Prueba la extracción de un link sin guardar nada |
| `pnpm test` | Pruebas (Vitest) |
| `pnpm typecheck` / `pnpm check` | TypeScript / Biome |

## Estructura

```
src/
  routes/          # Rutas basadas en archivos (TanStack Router)
    __root.tsx     # Documento HTML, layout global
    index.tsx      # Dashboard de productos
    products/$productId.tsx  # Detalle (ruta dinámica)
  server/          # Server functions (createServerFn): puente UI -> servicios
  services/        # Lógica de negocio (reutilizable por web, bot y worker)
  db/              # Esquema Drizzle, conexión y migrador
  components/      # UI (components/ui = shadcn)
  lib/             # Utilidades (tema, formato de precios)
drizzle/           # Migraciones SQL generadas
data/              # SQLite y capturas (ignorado por git)
```

## Notas

- Los precios se guardan en **centavos** (enteros).
- En Mercado Libre se rastrea la **publicación de un vendedor específico** (`sellerLock`), no el producto de catálogo.
