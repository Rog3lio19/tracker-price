import { afterEach, describe, expect, it, vi } from "vitest";

import { NotConfiguredError } from "../types";
import { scrapeMercadoLibre } from "./api";

// No queremos tocar la base de datos ni la red: el token es falso y `fetch`
// responde con datos copiados de la API real (2026-10-29)
vi.mock("./oauth", () => ({ getAccessToken: async () => "TOKEN" }));

const OFFER = {
	item_id: "MLM2435448603",
	seller_id: 1067591234,
	price: 662,
	original_price: 990,
};

function mockApi(routes: Record<string, unknown>) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string) => {
			const path = url.replace("https://api.mercadolibre.com", "");
			if (!(path in routes)) return new Response("{}", { status: 404 });
			return Response.json(routes[path]);
		}),
	);
}

afterEach(() => vi.unstubAllGlobals());

describe("scrapeMercadoLibre", () => {
	it("lee el precio de oferta de la publicación elegida", async () => {
		mockApi({
			"/products/MLM19715509": { name: "Armaf Club De Nuit Urban Man Elixir" },
			"/products/MLM19715509/items?item_id=MLM2435448603": {
				results: [OFFER],
			},
			"/users/1067591234": { nickname: "PRODUCTOINCREIBLE" },
		});

		const result = await scrapeMercadoLibre({
			externalId: "MLM2435448603",
			catalogProductId: "MLM19715509",
		});

		expect(result).toMatchObject({
			itemId: "MLM2435448603",
			price: 66200,
			listPrice: 99000,
			inStock: true,
			sellerId: "1067591234",
			sellerName: "PRODUCTOINCREIBLE",
		});
	});

	it("sin publicación elegida toma la oferta más barata", async () => {
		mockApi({
			"/products/MLM19715509": { name: "Armaf" },
			"/products/MLM19715509/items": {
				results: [
					{ ...OFFER, item_id: "MLM2", seller_id: 2, price: 909 },
					OFFER,
				],
			},
		});

		const result = await scrapeMercadoLibre({
			externalId: null,
			catalogProductId: "MLM19715509",
		});

		expect(result.itemId).toBe("MLM2435448603");
		expect(result.price).toBe(66200);
	});

	it("si la publicación ya no está en el catálogo, la marca sin stock", async () => {
		mockApi({ "/products/MLM19715509": { name: "Armaf" } });

		const result = await scrapeMercadoLibre({
			externalId: "MLM2435448603",
			catalogProductId: "MLM19715509",
		});

		expect(result).toMatchObject({ inStock: false, price: null });
	});

	it("rechaza publicaciones que no son de catálogo", async () => {
		await expect(
			scrapeMercadoLibre({
				externalId: "MLM4996777552",
				catalogProductId: null,
			}),
		).rejects.toThrow(NotConfiguredError);
	});
});
