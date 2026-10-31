/**
 * Revisar un producto = extraer su precio actual y registrarlo.
 * Lo usa el botón "Revisar ahora", el comando `pnpm check` y (Fase 3) el worker.
 */
import { desc, eq, sql } from "drizzle-orm";

import { db } from "#/db";
import {
	type Product,
	priceSnapshots,
	products,
	scrapeErrors,
} from "#/db/schema";
import { isSuspiciousChange } from "#/lib/suspicious";
import { BlockedError, type ProductScrape, scrapeProduct } from "#/scraper";

export type CheckOutcome =
	| {
			kind: "ok";
			price: number | null;
			listPrice: number | null;
			inStock: boolean;
			suspicious: boolean;
			/** Lo que sabíamos ANTES de esta revisión (para detectar bajadas) */
			previous: {
				price: number | null;
				lowestPrice: number | null;
				wasInStock: boolean;
			};
	  }
	| { kind: "seller_changed"; expected: string; found: string }
	| { kind: "blocked"; store: Product["marketplace"]; message: string }
	| { kind: "error"; message: string };

export async function checkProduct(productId: number): Promise<CheckOutcome> {
	const [product] = await db
		.select()
		.from(products)
		.where(eq(products.id, productId));
	if (!product) return { kind: "error", message: "El producto no existe" };

	let result: ProductScrape;
	try {
		result = await scrapeProduct(product);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await recordFailure(product, message);
		return error instanceof BlockedError
			? { kind: "blocked", store: error.store, message }
			: { kind: "error", message };
	}

	// --- Candado de vendedor ---------------------------------------------------
	// Si el producto está amarrado a un vendedor y la publicación ahora es de
	// otro, NO registramos ese precio: no queremos alertas de vendedores
	// en los que no confías.
	if (
		product.sellerLock &&
		product.sellerId &&
		result.sellerId &&
		result.sellerId !== product.sellerId
	) {
		await db
			.update(products)
			.set({ status: "seller_changed", lastCheckedAt: new Date() })
			.where(eq(products.id, product.id));
		return {
			kind: "seller_changed",
			expected: product.sellerName ?? product.sellerId,
			found: result.sellerName ?? result.sellerId,
		};
	}

	// ¿Cambio brusco? Se confirma si la revisión anterior vio casi el mismo precio
	const [lastSnapshot] = await db
		.select({
			price: priceSnapshots.price,
			isSuspicious: priceSnapshots.isSuspicious,
		})
		.from(priceSnapshots)
		.where(eq(priceSnapshots.productId, product.id))
		.orderBy(desc(priceSnapshots.id))
		.limit(1);
	const suspicious = isSuspiciousChange(
		result.price,
		product.lastPrice,
		lastSnapshot?.isSuspicious ? lastSnapshot.price : null,
	);

	await db.transaction(async (tx) => {
		await tx.insert(priceSnapshots).values({
			productId: product.id,
			price: result.price,
			listPrice: result.listPrice,
			inStock: result.inStock,
			sellerId: result.sellerId,
			source: result.source,
			isSuspicious: suspicious,
		});

		const countsForLowest = result.price != null && !suspicious;
		await tx
			.update(products)
			.set({
				// Completamos datos que no teníamos al agregar el producto
				title: result.title ?? product.title,
				imageUrl: result.imageUrl ?? product.imageUrl,
				// Primera vez que vemos al vendedor: queda fijado
				sellerId: product.sellerId ?? result.sellerId,
				sellerName: result.sellerName ?? product.sellerName,
				// Catálogo de ML: guardamos la publicación que ganó la caja de compra
				externalId: result.itemId ?? product.externalId,
				status: nextStatus(product, result.inStock),
				// Un precio sospechoso no reemplaza al último confirmado hasta confirmarse
				lastPrice: suspicious
					? product.lastPrice
					: (result.price ?? product.lastPrice),
				lowestPrice: countsForLowest
					? sql`least(coalesce(${products.lowestPrice}, ${result.price}::integer), ${result.price}::integer)`
					: product.lowestPrice,
				lastCheckedAt: new Date(),
				consecutiveFailures: 0,
			})
			.where(eq(products.id, product.id));
	});

	return {
		kind: "ok",
		price: result.price,
		listPrice: result.listPrice,
		inStock: result.inStock,
		suspicious,
		previous: {
			price: product.lastPrice,
			lowestPrice: product.lowestPrice,
			wasInStock: product.status !== "out_of_stock",
		},
	};
}

function nextStatus(product: Product, inStock: boolean): Product["status"] {
	if (product.status === "paused") return "paused";
	return inStock ? "active" : "out_of_stock";
}

/** Tras varios fallos seguidos el producto pasa a "error" para que lo revises */
const FAILURES_BEFORE_ERROR = 3;

async function recordFailure(product: Product, message: string) {
	const failures = product.consecutiveFailures + 1;
	await db.transaction(async (tx) => {
		await tx.insert(scrapeErrors).values({ productId: product.id, message });
		await tx
			.update(products)
			.set({
				consecutiveFailures: failures,
				lastCheckedAt: new Date(),
				status:
					failures >= FAILURES_BEFORE_ERROR && product.status !== "paused"
						? "error"
						: product.status,
			})
			.where(eq(products.id, product.id));
	});
}
