# Tracker Price

Rastreador de precios para Amazon MX y Mercado Libre con alertas por Telegram.

**Stack:** TanStack Start · Drizzle ORM · PostgreSQL (node-postgres) · shadcn/ui · Tailwind v4 · paleta Tokyo Night

## Desarrollo

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate      # aplica las migraciones a la base de DATABASE_URL
pnpm dev             # http://localhost:3000
```

## Despliegue

Necesitas un PostgreSQL y la variable `DATABASE_URL`. El `Dockerfile` construye una sola imagen que sirve para dos procesos:

| Proceso | Comando |
|---|---|
| Web (dashboard en el puerto `3000`) | el de la imagen: aplica migraciones y arranca Nitro |
| Worker (revisa precios y atiende el bot de Telegram) | `node --import tsx scripts/worker.ts` |

Ambos usan el mismo `DATABASE_URL` y el resto de variables de `.env.example`.

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
data/              # Capturas (ignorado por git)
```

## Notas

- Los precios se guardan en **centavos** (enteros).
- En Mercado Libre se rastrea la **publicación de un vendedor específico** (`sellerLock`), no el producto de catálogo.
