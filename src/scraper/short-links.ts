import { ProductUrlError } from "#/lib/product-url";

import { fetchPage } from "./http";

const SHORT_LINK_HOSTS = new Set(["amzn.to", "a.co", "amzn.eu", "meli.la"]);

export function isShortLink(raw: string) {
	try {
		return SHORT_LINK_HOSTS.has(new URL(raw).hostname);
	} catch {
		return false;
	}
}

/**
 * Convierte un link corto en el link real del producto.
 *
 * - amzn.to / a.co: basta con seguir las redirecciones.
 * - meli.la: los links de afiliado llevan a un "perfil social"
 *   (mercadolibre.com.mx/social/...) que muestra el producto compartido como
 *   tarjeta destacada. Hay que abrir esa página y sacar el producto de ahí.
 */
export async function resolveShortLink(rawUrl: string) {
	let current = rawUrl;
	// Leemos solo el header Location de cada salto. Algunos acortadores
	// (meli.la) no aceptan HEAD, por eso usamos GET.
	for (let hop = 0; hop < 5 && isShortLink(current); hop++) {
		const response = await fetchPage(current, { redirect: "manual" }).catch(
			() => null,
		);
		const location = response?.headers.get("location");
		if (!location) {
			throw new ProductUrlError(
				"No pude abrir el link corto, pega el link completo",
			);
		}
		current = new URL(location, current).toString();
	}

	if (new URL(current).pathname.startsWith("/social/")) {
		const response = await fetchPage(current);
		const featured = response.ok
			? extractFeaturedSocialItem(await response.text())
			: null;
		if (!featured) {
			throw new ProductUrlError(
				"El link lleva a un perfil de Mercado Libre y no encontré el producto. Pega el link del producto",
			);
		}
		return featured;
	}

	return current;
}

/**
 * En la página social, cada producto es una "polycard" con metadata JSON.
 * La que se compartió tiene "card-featured" en sus url_fragments (tracking).
 */
export function extractFeaturedSocialItem(html: string) {
	const cardRe = /"metadata":\{"id":"MLM\d+"/g;
	for (const match of html.matchAll(cardRe)) {
		const chunk = html.slice(match.index, match.index + 3000);
		const fragments = readJsonString(chunk, "url_fragments");
		if (!fragments?.includes("card-featured")) continue;

		const url = readJsonString(chunk, "url");
		if (!url) continue;
		// `url` viene sin protocolo; url_params trae el item_id del vendedor
		const params = readJsonString(chunk, "url_params") ?? "";
		const base = url.split("?")[0];
		return `https://${base}${params}`;
	}
	return null;
}

/** Lee "key":"valor" de un pedazo de JSON, des-escapando / y similares */
function readJsonString(chunk: string, key: string) {
	const match = chunk.match(new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`));
	if (!match) return null;
	try {
		return JSON.parse(`"${match[1]}"`) as string;
	} catch {
		return null;
	}
}
