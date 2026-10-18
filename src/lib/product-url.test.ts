import { describe, expect, it } from "vitest";

import { isShortLink, parseProductUrl } from "./product-url";

describe("parseProductUrl — Amazon", () => {
	it.each([
		"https://www.amazon.com.mx/Audifonos-Inalambricos/dp/B0CHX1W1XY/ref=sr_1_3?keywords=audifonos&qid=1",
		"https://amazon.com.mx/gp/product/B0CHX1W1XY?th=1",
		"https://www.amazon.com.mx/gp/aw/d/B0CHX1W1XY",
		"amazon.com.mx/dp/b0chx1w1xy",
	])("extrae el ASIN de %s", (url) => {
		expect(parseProductUrl(url)).toEqual({
			marketplace: "amazon",
			canonicalUrl: "https://www.amazon.com.mx/dp/B0CHX1W1XY",
			externalId: "B0CHX1W1XY",
			catalogProductId: null,
		});
	});

	it("rechaza links de Amazon sin ASIN", () => {
		expect(() =>
			parseProductUrl("https://www.amazon.com.mx/s?k=perfume"),
		).toThrow(/ASIN/);
	});

	it("rechaza Amazon de otros países", () => {
		expect(() =>
			parseProductUrl("https://www.amazon.com/dp/B0CHX1W1XY"),
		).toThrow(/México/);
	});
});

describe("parseProductUrl — Mercado Libre", () => {
	it("publicación de un vendedor", () => {
		expect(
			parseProductUrl(
				"https://articulo.mercadolibre.com.mx/MLM-1234567890-perfume-dior-sauvage-100ml-_JM#position=2&search_layout=grid",
			),
		).toEqual({
			marketplace: "mercadolibre",
			canonicalUrl: "https://articulo.mercadolibre.com.mx/MLM-1234567890",
			externalId: "MLM1234567890",
			catalogProductId: null,
		});
	});

	it("catálogo con el vendedor elegido en el hash (wid)", () => {
		expect(
			parseProductUrl(
				"https://www.mercadolibre.com.mx/dior-sauvage-edt-100ml/p/MLM15583340#polycard_client=search&wid=MLM2087654321&sid=search",
			),
		).toEqual({
			marketplace: "mercadolibre",
			canonicalUrl: "https://articulo.mercadolibre.com.mx/MLM-2087654321",
			externalId: "MLM2087654321",
			catalogProductId: "MLM15583340",
		});
	});

	it("catálogo con el vendedor en pdp_filters", () => {
		const parsed = parseProductUrl(
			"https://www.mercadolibre.com.mx/p/MLM15583340?pdp_filters=item_id%3AMLM2087654321",
		);
		expect(parsed.externalId).toBe("MLM2087654321");
		expect(parsed.catalogProductId).toBe("MLM15583340");
	});

	it("catálogo sin vendedor", () => {
		expect(
			parseProductUrl(
				"https://www.mercadolibre.com.mx/dior-sauvage/p/MLM15583340",
			),
		).toEqual({
			marketplace: "mercadolibre",
			canonicalUrl: "https://www.mercadolibre.com.mx/p/MLM15583340",
			externalId: null,
			catalogProductId: "MLM15583340",
		});
	});

	it("user product (/up/)", () => {
		expect(
			parseProductUrl(
				"https://www.mercadolibre.com.mx/perfume-x/up/MLMU123456789?attributes=SIZE",
			),
		).toMatchObject({
			canonicalUrl: "https://www.mercadolibre.com.mx/up/MLMU123456789",
			externalId: "MLMU123456789",
		});
	});

	it("rechaza búsquedas", () => {
		expect(() =>
			parseProductUrl("https://listado.mercadolibre.com.mx/perfume-dior"),
		).toThrow();
	});
});

describe("otros casos", () => {
	it("rechaza tiendas no soportadas y basura", () => {
		expect(() => parseProductUrl("https://www.liverpool.com.mx/x")).toThrow(
			/Amazon y Mercado Libre/,
		);
		expect(() => parseProductUrl("hola mundo")).toThrow();
	});

	it("detecta links cortos", () => {
		expect(isShortLink("https://amzn.to/3abcXYZ")).toBe(true);
		expect(isShortLink("https://meli.la/1AbCdEf")).toBe(true);
		expect(isShortLink("https://www.amazon.com.mx/dp/B0CHX1W1XY")).toBe(false);
	});
});
