/**
 * Aplica las migraciones pendientes de ./drizzle.
 * Se usa en producción (Docker) al arrancar: `node --import tsx src/db/migrate.ts`
 * En desarrollo puedes usar `pnpm db:migrate`, que hace lo mismo vía drizzle-kit.
 */
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { db } from "./index.ts";

migrate(db, { migrationsFolder: "./drizzle" });
console.log("✓ Migraciones aplicadas");
