import type { ExtractionSource } from "#/db/schema";

/** Lo que cualquier extractor (Amazon, Mercado Libre, visión...) debe devolver */
export type ScrapeResult = {
	title: string | null;
	imageUrl: string | null;
	/** Centavos. null si no hay stock o no se encontró */
	price: number | null;
	/** Precio "antes" (tachado), en centavos */
	listPrice: number | null;
	inStock: boolean;
	sellerId: string | null;
	sellerName: string | null;
	source: ExtractionSource;
};

/** La tienda nos está frenando (CAPTCHA, 429, 503...). No reintentar de inmediato. */
export class BlockedError extends Error {
	constructor(
		readonly store: "amazon" | "mercadolibre",
		message: string,
	) {
		super(message);
	}
}

/** La página cargó pero no pudimos interpretar el precio (¿cambió el HTML?) */
export class ExtractionError extends Error {}

/** Falta configurar algo (ej. conectar la cuenta de Mercado Libre) */
export class NotConfiguredError extends Error {}
