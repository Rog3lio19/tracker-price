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

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción (Nitro, Node) en `.output/` |
| `pnpm db:generate` | Genera una migración a partir de cambios en `src/db/schema.ts` |
| `pnpm db:migrate` | Aplica migraciones pendientes |
| `pnpm db:studio` | Explorador visual de la DB |
| `pnpm typecheck` / `pnpm check` | TypeScript / Biome |

## Estructura

```
src/
  routes/          # Rutas basadas en archivos (TanStack Router)
    __root.tsx     # Documento HTML, layout global
    index.tsx      # Dashboard de productos
  server/          # Server functions (createServerFn): solo corren en el servidor
  db/              # Esquema Drizzle, conexión y migrador
  components/      # UI (components/ui = shadcn)
  lib/             # Utilidades (tema, formato de precios)
drizzle/           # Migraciones SQL generadas
data/              # SQLite y capturas (ignorado por git)
```

## Notas

- Los precios se guardan en **centavos** (enteros).
- En Mercado Libre se rastrea la **publicación de un vendedor específico** (`sellerLock`), no el producto de catálogo.
