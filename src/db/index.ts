import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema.ts";

// La conexión es perezosa: no se abre hasta la primera consulta
export const pool = new Pool({
	connectionString:
		process.env.DATABASE_URL ??
		"postgres://postgres:postgres@localhost:5432/tracker_price",
});

export const db = drizzle(pool, { schema });
