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

`Dockerfile` construye una sola imagen que, en un solo contenedor, aplica las migraciones y corre la web (puerto `3000`) y el worker (revisa precios y atiende el bot de Telegram).

```bash
docker build -t tracker-price .
docker run -d -p 3000:3000 -v tracker-data:/data --env-file .env tracker-price
```

La base SQLite vive en `/data/tracker.db` (`DATABASE_URL`): monta ahí un **volumen persistente**, o perderás los datos al recrear el contenedor. Si la web o el worker se caen, el contenedor termina para que la plataforma lo reinicie.

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
