/**
 * Mercado Libre vía su API oficial (requiere conectar tu cuenta, ver oauth.ts).
 *
 * OJO, restricción de ML (probado 2026-10-29): con el token de una app normal,
 * `/items/{id}`, `/items/{id}/sale_price` y `/sites/MLM/search` responden 403
 * para publicaciones de OTROS vendedores. Lo que sí está permitido es el
 * catálogo: `/products/{catalogo}/items` lista las ofertas de cada vendedor con
 * su precio de oferta y su precio original. Por eso solo podemos rastrear
 * publicaciones que pertenecen a un producto de catálogo (las URLs `/p/MLM...`).
 */
import { toCents } from "../price";
import {
	BlockedError,
	ExtractionError,
	NotConfiguredError,
	type ScrapeResult,
} from "../types";
import { getAccessToken } from "./oauth";

const API = "https://api.mercadolibre.com";

type MlCatalogProduct = {
	name: string;
	pictures?: { url: string }[];
};

/** Una oferta (publicación de un vendedor) dentro de un producto de catálogo */
type MlCatalogOffer = {
	item_id: string;
	seller_id: number;
	/** Precio final, con la promoción ya aplicada */
	price: number;
	/** Precio "antes" cuando hay descuento; null si no hay oferta */
	original_price: number | null;
};

type MlCatalogItems = { results: MlCatalogOffer[] };

export type MercadoLibreResult = ScrapeResult & {
	/** ID de la publicación que se revisó (útil si el producto era solo de catálogo) */
	itemId: string;
};

export async function scrapeMercadoLibre(product: {
	externalId: string | null;
	catalogProductId: string | null;
}): Promise<MercadoLibreResult> {
	const catalogId = product.catalogProductId;
	if (!catalogId) {
		throw new NotConfiguredError(
			"Mercado Libre solo nos deja consultar productos de catálogo (links /p/MLM...). Esta publicación no pertenece a uno.",
		);
	}
	// MLMU... es un "user product", no una publicación concreta
	const itemId = product.externalId?.startsWith("MLMU")
		? null
		: product.externalId;

	const catalog = await apiGet<MlCatalogProduct>(`/products/${catalogId}`);
	const base = {
		title: catalog.name,
		imageUrl: catalog.pictures?.[0]?.url ?? null,
		source: "api" as const,
	};

	// Sin publicación elegida tomamos la oferta más barata; después de esta
	// primera revisión queda fijada junto con su vendedor.
	const offers = await getOffers(catalogId, itemId);
	const offer = offers[0];

	if (!offer) {
		if (!itemId) {
			throw new ExtractionError(
				"Ningún vendedor está ofreciendo este producto de catálogo ahora",
			);
		}
		// La publicación ya no aparece entre las ofertas: está pausada, sin
		// stock o la quitaron del catálogo. Desde la API no se distingue.
		return {
			...base,
			itemId,
			price: null,
			listPrice: null,
			inStock: false,
			sellerId: null,
			sellerName: null,
		};
	}

	const seller = await apiGet<{ nickname: string }>(
		`/users/${offer.seller_id}`,
	).catch(() => null);

	const price = toCents(offer.price);
	const listPrice = toCents(offer.original_price);

	return {
		...base,
		itemId: offer.item_id,
		price,
		listPrice:
			listPrice != null && price != null && listPrice > price
				? listPrice
				: null,
		inStock: price != null,
		sellerId: String(offer.seller_id),
		sellerName: seller?.nickname ?? null,
	};
}

/** Ofertas del catálogo; con itemId, solo la de esa publicación (o ninguna) */
async function getOffers(catalogId: string, itemId: string | null) {
	const query = itemId ? `?item_id=${itemId}` : "";
	try {
		const data = await apiGet<MlCatalogItems>(
			`/products/${catalogId}/items${query}`,
		);
		// ML las devuelve ordenadas por precio, pero no lo documenta
		return data.results.sort((a, b) => a.price - b.price);
	} catch (error) {
		// 404 aquí significa "no hay ofertas que coincidan", no que falte el producto
		if (error instanceof NotFoundError) return [];
		throw error;
	}
}

class NotFoundError extends ExtractionError {}

async function apiGet<T>(path: string): Promise<T> {
	const token = await getAccessToken();
	const response = await fetch(`${API}${path}`, {
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
		signal: AbortSignal.timeout(15_000),
	});
	if (response.status === 429) {
		throw new BlockedError(
			"mercadolibre",
			"Mercado Libre: demasiadas peticiones (429)",
		);
	}
	if (response.status === 404) {
		throw new NotFoundError(
			`Mercado Libre dice que ${path.split("?")[0]} no existe (404)`,
		);
	}
	if (!response.ok) {
		const detail = (await response.text()).slice(0, 200);
		throw new ExtractionError(
			`API de Mercado Libre ${response.status} en ${path}: ${detail}`,
		);
	}
	return (await response.json()) as T;
}
