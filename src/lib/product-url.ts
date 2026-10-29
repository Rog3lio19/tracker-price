import type { Marketplace } from "#/db/schema";

export type ParsedProductUrl = {
	marketplace: Marketplace;
	/** URL limpia: sin tracking, sin slug. Es la llave para evitar duplicados. */
	canonicalUrl: string;
	/** ASIN (Amazon) o ID de publicación MLM123... / MLMU123... (Mercado Libre) */
	externalId: string | null;
	/** Solo Mercado Libre: ID de catálogo (/p/MLM...) */
	catalogProductId: string | null;
};

export class ProductUrlError extends Error {}

export function parseProductUrl(raw: string): ParsedProductUrl {
	const url = tryParseUrl(raw.trim());
	if (!url) throw new ProductUrlError("No parece una URL válida");

	const host = url.hostname.toLowerCase();

	if (host === "amazon.com.mx" || host.endsWith(".amazon.com.mx")) {
		return parseAmazon(url);
	}
	if (host === "mercadolibre.com.mx" || host.endsWith(".mercadolibre.com.mx")) {
		return parseMercadoLibre(url);
	}
	if (host.includes("amazon.") || host.includes("mercadolibre.")) {
		throw new ProductUrlError(
			"Por ahora solo se soportan las tiendas de México",
		);
	}
	throw new ProductUrlError("Solo se soportan links de Amazon y Mercado Libre");
}

function tryParseUrl(raw: string) {
	try {
		// Si pegaron "amazon.com.mx/dp/..." sin protocolo, lo agregamos
		return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
	} catch {
		return null;
	}
}

// --- Amazon ---------------------------------------------------------------

// /dp/B0ABC12345, /gp/product/B0ABC12345, /gp/aw/d/B0ABC12345, /o/ASIN/...
const AMAZON_ASIN_RE =
	/\/(?:dp|gp\/product|gp\/aw\/d|o\/ASIN|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?:[/?]|$)/i;

function parseAmazon(url: URL): ParsedProductUrl {
	const asin = url.pathname.match(AMAZON_ASIN_RE)?.[1]?.toUpperCase();
	if (!asin) {
		throw new ProductUrlError(
			"No encontré el código del producto (ASIN) en el link de Amazon",
		);
	}
	return {
		marketplace: "amazon",
		canonicalUrl: `https://www.amazon.com.mx/dp/${asin}`,
		externalId: asin,
		catalogProductId: null,
	};
}

// --- Mercado Libre --------------------------------------------------------
//
// Hay tres formatos de link:
//  1. Publicación de un vendedor:  articulo.mercadolibre.com.mx/MLM-123456789-slug-_JM
//  2. Catálogo (varios vendedores): mercadolibre.com.mx/slug/p/MLM12345678
//     Si lo copiaste estando en la página, suele traer el vendedor elegido en
//     el hash (#...wid=MLM123456789) o en ?pdp_filters=item_id:MLM123456789
//  3. "User product" de un vendedor: mercadolibre.com.mx/slug/up/MLMU123456789
//     (también suele traer ?pdp_filters=item_id:MLM... con la publicación)

const ML_ITEM_PATH_RE = /\/(MLM)-?(\d{6,})/i;
const ML_CATALOG_RE = /\/p\/(MLM\d+)/i;
const ML_USER_PRODUCT_RE = /\/up\/(MLMU\d+)/i;
const ML_ITEM_IN_PARAMS_RE = /(?:wid=|item_id[:=]|item_id%3A)(MLM)-?(\d{6,})/i;

function parseMercadoLibre(url: URL): ParsedProductUrl {
	const catalogProductId =
		url.pathname.match(ML_CATALOG_RE)?.[1]?.toUpperCase() ?? null;

	// El ID de la publicación del vendedor puede venir en params/hash (links de
	// catálogo o /up/) o en el path (links de articulo.mercadolibre.com.mx)
	const itemMatch =
		`${url.search}${url.hash}`.match(ML_ITEM_IN_PARAMS_RE) ??
		(catalogProductId ? null : url.pathname.match(ML_ITEM_PATH_RE));
	const itemId = itemMatch ? `MLM${itemMatch[2]}` : null;

	if (itemId) {
		return {
			marketplace: "mercadolibre",
			// Si hay publicación, la canónica es la del VENDEDOR, no la del catálogo
			canonicalUrl: `https://articulo.mercadolibre.com.mx/MLM-${itemId.slice(3)}`,
			externalId: itemId,
			catalogProductId,
		};
	}

	const userProductId = url.pathname
		.match(ML_USER_PRODUCT_RE)?.[1]
		?.toUpperCase();
	if (userProductId) {
		return {
			marketplace: "mercadolibre",
			canonicalUrl: `https://www.mercadolibre.com.mx/up/${userProductId}`,
			externalId: userProductId,
			catalogProductId: null,
		};
	}

	if (catalogProductId) {
		// Catálogo sin vendedor: en la primera revisión se fija el vendedor actual
		return {
			marketplace: "mercadolibre",
			canonicalUrl: `https://www.mercadolibre.com.mx/p/${catalogProductId}`,
			externalId: null,
			catalogProductId,
		};
	}

	throw new ProductUrlError(
		"No encontré el ID del producto en el link de Mercado Libre",
	);
}
