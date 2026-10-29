import * as cheerio from "cheerio";

import { fetchPage } from "./http";
import { parsePriceToCents, toCents } from "./price";
import { BlockedError, ExtractionError, type ScrapeResult } from "./types";

const AMAZON_SELLER = { id: "amazon", name: "Amazon México" };

export async function scrapeAmazon(
	canonicalUrl: string,
): Promise<ScrapeResult> {
	const response = await fetchPage(canonicalUrl);

	if (response.status === 503 || response.status === 429) {
		throw new BlockedError("amazon", `Amazon respondió ${response.status}`);
	}
	if (response.status === 404) {
		throw new ExtractionError("Amazon dice que el producto ya no existe (404)");
	}
	if (!response.ok) {
		throw new ExtractionError(`Amazon respondió ${response.status}`);
	}

	return parseAmazonHtml(await response.text());
}

/**
 * Separado de scrapeAmazon para poder probarlo con HTML guardado (fixtures),
 * sin hacer peticiones reales.
 */
export function parseAmazonHtml(html: string): ScrapeResult {
	const $ = cheerio.load(html);

	if (
		$('form[action*="validateCaptcha"]').length > 0 ||
		$("input#captchacharacters").length > 0
	) {
		throw new BlockedError("amazon", "Amazon pidió CAPTCHA");
	}

	const title = $("#productTitle").text().trim() || null;
	if (!title) {
		throw new ExtractionError(
			"No encontré el título: ¿cambió la página de Amazon?",
		);
	}

	// OJO: la página trae MUCHOS precios (patrocinados, meses sin intereses,
	// otros vendedores...). Siempre buscamos dentro del bloque principal.
	const price = readBuyboxPrice($) ?? readCorePrice($);
	const listPrice = parsePriceToCents(
		$(
			'#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen, #corePrice_feature_div .a-text-price[data-a-strike="true"] .a-offscreen',
		)
			.first()
			.text(),
	);

	const availability = $("#availability").text().replace(/\s+/g, " ").trim();
	const inStock =
		price != null &&
		$("#outOfStock").length === 0 &&
		!/no disponible|agotado|currently unavailable/i.test(availability);

	return {
		title,
		imageUrl: readImage($),
		price: inStock ? price : null,
		// Solo tiene sentido si es mayor al precio actual
		listPrice:
			listPrice != null && price != null && listPrice > price
				? listPrice
				: null,
		inStock,
		...readSeller($),
		source: "selector",
	};
}

/** JSON interno con el precio de la oferta principal (el más confiable) */
function readBuyboxPrice($: cheerio.CheerioAPI) {
	const raw = $(".twister-plus-buying-options-price-data").first().text();
	if (!raw) return null;
	try {
		const data = JSON.parse(raw) as Record<
			string,
			{ priceAmount?: number; buyingOptionType?: string }[]
		>;
		const offer = data.desktop_buybox_group_1?.[0];
		return toCents(offer?.priceAmount);
	} catch {
		return null;
	}
}

function readCorePrice($: cheerio.CheerioAPI) {
	return parsePriceToCents(
		$(
			"#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen, #corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen",
		)
			.first()
			.text(),
	);
}

function readSeller($: cheerio.CheerioAPI) {
	const link = $("#sellerProfileTriggerId").first();
	if (link.length > 0) {
		const href = link.attr("href") ?? "";
		const id = href.match(/[?&]seller=([A-Z0-9]+)/)?.[1] ?? null;
		return { sellerId: id, sellerName: link.text().trim() || null };
	}
	// Sin link de vendedor = lo vende Amazon directamente
	const merchant = $(
		"#merchantInfoFeature_feature_div .offer-display-feature-text",
	)
		.first()
		.text();
	if (/amazon/i.test(merchant)) {
		return { sellerId: AMAZON_SELLER.id, sellerName: AMAZON_SELLER.name };
	}
	return { sellerId: null, sellerName: null };
}

function readImage($: cheerio.CheerioAPI) {
	const img = $("#landingImage");
	const hires = img.attr("data-old-hires");
	if (hires) return hires;
	// data-a-dynamic-image = {"url": [w, h], ...}: tomamos la más grande
	try {
		const variants = JSON.parse(
			img.attr("data-a-dynamic-image") ?? "{}",
		) as Record<string, [number, number]>;
		const largest = Object.entries(variants).sort(
			(a, b) => b[1][0] - a[1][0],
		)[0];
		return largest?.[0] ?? img.attr("src") ?? null;
	} catch {
		return img.attr("src") ?? null;
	}
}
