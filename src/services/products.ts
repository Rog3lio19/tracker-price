/**
 * Lógica de productos, independiente de TanStack Start.
 * La usan las server functions (web), y más adelante el bot de Telegram y el worker.
 */
import { desc, eq, inArray, max } from "drizzle-orm";

import { db } from "#/db";
import { priceSnapshots, products, scrapeErrors } from "#/db/schema";
import { ProductUrlError, parseProductUrl } from "#/lib/product-url";
import { isShortLink, resolveShortLink } from "#/scraper/short-links";
import { createDefaultRules } from "#/services/alerts";

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

	const [existing] = await db
		.select({ id: products.id })
		.from(products)
		.where(eq(products.canonicalUrl, parsed.canonicalUrl));
	if (existing) return { status: "exists", id: existing.id };

	const [created] = await db
		.insert(products)
		.values({
			...parsed,
			url: rawUrl.trim(),
			// En Mercado Libre fijamos el vendedor (vendedores no confiables).
			// En Amazon el vendedor de la caja de compra cambia seguido y es normal.
			sellerLock: parsed.marketplace === "mercadolibre",
		})
		.returning({ id: products.id });
	if (!created) throw new Error("No se pudo guardar el producto");
	await createDefaultRules(created.id);
	return { status: "created", id: created.id };
}

/** Productos + el precio tachado de su revisión más reciente (para las tarjetas) */
export async function listProducts() {
	const all = await db
		.select()
		.from(products)
		.orderBy(desc(products.createdAt));

	const latestIds = db
		.select({ id: max(priceSnapshots.id) })
		.from(priceSnapshots)
		.groupBy(priceSnapshots.productId);
	const latest = await db
		.select({
			productId: priceSnapshots.productId,
			listPrice: priceSnapshots.listPrice,
		})
		.from(priceSnapshots)
		.where(inArray(priceSnapshots.id, latestIds));
	const listPrices = new Map(
		latest.map((row) => [row.productId, row.listPrice]),
	);

	return all.map((product) => ({
		...product,
		listPrice: listPrices.get(product.id) ?? null,
	}));
}

export function getProductWithHistory(id: number) {
	return db.query.products.findFirst({
		where: eq(products.id, id),
		with: {
			snapshots: {
				orderBy: desc(priceSnapshots.checkedAt),
				limit: 300,
			},
			alertRules: true,
			errors: {
				orderBy: desc(scrapeErrors.occurredAt),
				limit: 5,
			},
		},
	});
}

export async function setProductPaused(id: number, paused: boolean) {
	await db
		.update(products)
		.set({ status: paused ? "paused" : "active" })
		.where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
	// Las tablas hijas (snapshots, alertas...) se borran solas por ON DELETE CASCADE
	await db.delete(products).where(eq(products.id, id));
}
