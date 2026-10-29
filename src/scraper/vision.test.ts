import { describe, expect, it } from "vitest";

import { ExtractionError } from "./types";
import { parseVisionResponse } from "./vision";

describe("parseVisionResponse", () => {
	it("lee un JSON limpio y convierte pesos a centavos", () => {
		const result = parseVisionResponse(
			'{"title":"NICEHCK Tears","price":608.96,"list_price":null,"in_stock":true,"confidence":0.95}',
		);
		expect(result).toMatchObject({
			title: "NICEHCK Tears",
			price: 60896,
			listPrice: null,
			inStock: true,
			confidence: 0.95,
			source: "vision",
		});
	});

	it("tolera bloques ```json y texto alrededor", () => {
		const result = parseVisionResponse(
			'Claro, aquí está:\n```json\n{"price":662,"list_price":990,"in_stock":true}\n```\nListo.',
		);
		expect(result).toMatchObject({ price: 66200, listPrice: 99000 });
	});

	it("ignora un precio tachado que no es mayor al actual", () => {
		const result = parseVisionResponse(
			'{"price":500,"list_price":400,"in_stock":true}',
		);
		expect(result.listPrice).toBeNull();
	});

	it("sin precio visible cuenta como sin stock", () => {
		const result = parseVisionResponse('{"price":null,"in_stock":true}');
		expect(result).toMatchObject({ price: null, inStock: false });
	});

	it("rechaza respuestas que no son JSON o no tienen el formato", () => {
		expect(() => parseVisionResponse("no veo la imagen")).toThrow(
			ExtractionError,
		);
		expect(() => parseVisionResponse('{"price":"mil"}')).toThrow(
			ExtractionError,
		);
	});
});
