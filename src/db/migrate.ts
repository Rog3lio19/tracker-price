/**
 * Aplica las migraciones pendientes de ./drizzle.
 * Se usa en producción al arrancar: `node --import tsx src/db/migrate.ts`
 * En desarrollo puedes usar `pnpm db:migrate`, que hace lo mismo.
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db, pool } from "./index.ts";

try {
	await migrate(db, { migrationsFolder: "./drizzle" });
	console.log("✓ Migraciones aplicadas");
} finally {
	// Sin cerrar el pool, el proceso se queda esperando conexiones
	await pool.end();
}
