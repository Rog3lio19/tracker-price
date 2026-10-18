import { createServerFn } from "@tanstack/react-start";
import { desc } from "drizzle-orm";

import { db } from "#/db";
import { products } from "#/db/schema";

/**
 * Las server functions corren SOLO en el servidor (aquí sí podemos tocar SQLite),
 * pero se pueden llamar desde el cliente o desde un loader como si fueran
 * funciones normales: TanStack Start genera el endpoint RPC por ti.
 */
export const listProducts = createServerFn({ method: "GET" }).handler(
	async () => {
		return db.select().from(products).orderBy(desc(products.createdAt));
	},
);
