/**
 * Lógica de productos, independiente de TanStack Start.
 * La usan las server functions (web), y más adelante el bot de Telegram y el worker.
 */
import { desc, eq } from "drizzle-orm";

import { db } from "#/db";
import { priceSnapshots, products, scrapeErrors } from "#/db/schema";
import { ProductUrlError, parseProductUrl } from "#/lib/product-url";
import { isShortLink, resolveShortLink } from "#/scraper/short-links";

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

	// La API de ML solo deja leer ofertas de catálogo (ver scraper/mercadolibre/api.ts)
	if (parsed.marketplace === "mercadolibre" && !parsed.catalogProductId) {
		return {
			status: "invalid",
			error:
				"Mercado Libre solo nos deja rastrear productos de catálogo: abre el producto, elige al vendedor en «Otras opciones de compra» y copia ese link (el que tiene /p/MLM...).",
		};
	}

	const existing = db
		.select({ id: products.id })
		.from(products)
		.where(eq(products.canonicalUrl, parsed.canonicalUrl))
		.get();
	if (existing) return { status: "exists", id: existing.id };

	const created = db
		.insert(products)
		.values({
			...parsed,
			url: rawUrl.trim(),
			// En Mercado Libre fijamos el vendedor (vendedores no confiables).
			// En Amazon el vendedor de la caja de compra cambia seguido y es normal.
			sellerLock: parsed.marketplace === "mercadolibre",
		})
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
				errors: {
					orderBy: desc(scrapeErrors.occurredAt),
					limit: 5,
				},
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
