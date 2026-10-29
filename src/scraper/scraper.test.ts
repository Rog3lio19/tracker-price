import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { parseAmazonHtml } from "./amazon";
import { parsePriceToCents } from "./price";
import { extractFeaturedSocialItem, isShortLink } from "./short-links";
import { BlockedError } from "./types";

/** HTML real guardado el 2026-10-18 (comprimido para no inflar el repo) */
function fixture(name: string) {
	return gunzipSync(
		readFileSync(join(__dirname, "__fixtures__", name)),
	).toString();
}

describe("parseAmazonHtml", () => {
	it("extrae los datos del producto principal (NICEHCK Tears)", () => {
		expect(parseAmazonHtml(fixture("amazon-B0G5834M45.html.gz"))).toEqual({
			title: expect.stringMatching(/^NICEHCK Tears IEM/),
			imageUrl:
				"https://m.media-amazon.com/images/I/51QrAdHtlLL._AC_SL1500_.jpg",
			price: 60896,
			// La página trae precios tachados de productos PATROCINADOS ($9,409):
			// no deben confundirse con el de este producto
			listPrice: null,
			inStock: true,
			sellerId: "A1K0X5CMUM436N",
			sellerName: "NICEHCK Audio",
			source: "selector",
		});
	});

	it("detecta la página de CAPTCHA", () => {
		const captcha =
			'<html><body><form action="/errors/validateCaptcha"><input id="captchacharacters"></form></body></html>';
		expect(() => parseAmazonHtml(captcha)).toThrow(BlockedError);
	});
});

describe("meli.la (perfil social de afiliado)", () => {
	it("encuentra el producto destacado", () => {
		const url = extractFeaturedSocialItem(fixture("meli-social.html.gz"));
		expect(url).toMatch(
			/^https:\/\/www\.mercadolibre\.com\.mx\/silla-gamer-libernovo-omni-[^/]+\/up\/MLMU3846847924\?pdp_filters=item_id%3AMLM4996777552/,
		);
	});

	it("detecta links cortos", () => {
		expect(isShortLink("https://amzn.to/3abcXYZ")).toBe(true);
		expect(isShortLink("https://meli.la/2jGaVyw")).toBe(true);
		expect(isShortLink("https://www.amazon.com.mx/dp/B0CHX1W1XY")).toBe(false);
	});
});

describe("parsePriceToCents", () => {
	it.each([
		["$608.96", 60896],
		["$9,409.00", 940900],
		["$ 1,499", 149900],
		["", null],
		["gratis", null],
	])("%s -> %s", (input, expected) => {
		expect(parsePriceToCents(input)).toBe(expected);
	});
});
