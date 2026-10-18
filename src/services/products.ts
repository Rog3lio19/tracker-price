/**
 * Lógica de productos, independiente de TanStack Start.
 * La usan las server functions (web), y más adelante el bot de Telegram y el worker.
 */
import { desc, eq } from "drizzle-orm";

import { db } from "#/db";
import { priceSnapshots, products } from "#/db/schema";
import {
	isShortLink,
	ProductUrlError,
	parseProductUrl,
} from "#/lib/product-url";

export type AddProductResult =
	| { status: "created"; id: number }
	| { status: "exists"; id: number }
	| { status: "invalid"; error: string };

export async function addProductFromUrl(
	rawUrl: string,
): Promise<AddProductResult> {
	let parsed: ReturnType<typeof parseProductUrl>;
	try {
		const url = isShortLink(rawUrl) ? await resolveShortLink(rawUrl) : rawUrl;
		parsed = parseProductUrl(url);
	} catch (error) {
		if (error instanceof ProductUrlError) {
			return { status: "invalid", error: error.message };
		}
		throw error;
	}

	const existing = db
		.select({ id: products.id })
		.from(products)
		.where(eq(products.canonicalUrl, parsed.canonicalUrl))
		.get();
	if (existing) return { status: "exists", id: existing.id };

	const created = db
		.insert(products)
		.values({ ...parsed, url: rawUrl.trim() })
		.returning({ id: products.id })
		.get();
	return { status: "created", id: created.id };
}

export function listProducts() {
	return db.select().from(products).orderBy(desc(products.createdAt)).all();
}

export function getProductWithHistory(id: number) {
	return db.query.products
		.findFirst({
			where: eq(products.id, id),
			with: {
				snapshots: {
					orderBy: desc(priceSnapshots.checkedAt),
					limit: 50,
				},
				alertRules: true,
			},
		})
		.sync();
}

export function setProductPaused(id: number, paused: boolean) {
	db.update(products)
		.set({ status: paused ? "paused" : "active" })
		.where(eq(products.id, id))
		.run();
}

export function deleteProduct(id: number) {
	// Las tablas hijas (snapshots, alertas...) se borran solas por ON DELETE CASCADE
	db.delete(products).where(eq(products.id, id)).run();
}

/**
 * Sigue las redirecciones de amzn.to / meli.la leyendo solo el header
 * Location, sin descargar la página final (Amazon suele bloquear bots).
 */
async function resolveShortLink(rawUrl: string) {
	let current = rawUrl;
	for (let hop = 0; hop < 5 && isShortLink(current); hop++) {
		const response = await fetch(current, {
			method: "HEAD",
			redirect: "manual",
			signal: AbortSignal.timeout(8000),
		}).catch(() => null);
		const location = response?.headers.get("location");
		if (!location) {
			throw new ProductUrlError(
				"No pude abrir el link corto, pega el link completo",
			);
		}
		current = new URL(location, current).toString();
	}
	return current;
}
