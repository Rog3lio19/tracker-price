/**
 * Extracción por visión: le mandamos una captura de la página a un modelo con
 * imágenes (vía OpenRouter) y nos devuelve el precio que ve. Sirve cuando el
 * HTML no es confiable, por ejemplo con precios de oferta.
 *
 * OpenRouter usa el mismo formato que la API de OpenAI, así que cambiar de
 * modelo es solo cambiar OPENROUTER_MODEL.
 * Docs: https://openrouter.ai/docs/features/multimodal/images
 */
import { z } from "zod";

import { toCents } from "./price";
import {
	ExtractionError,
	NotConfiguredError,
	type ScrapeResult,
} from "./types";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
/** Gratis al 2026-10-29; la lista cambia seguido, ver https://openrouter.ai/models?q=free */
export const DEFAULT_VISION_MODEL = "nvidia/nemotron-3.5-super-vl:free";

const PROMPT = `Eres un lector de precios. La imagen es una captura de la página de un producto en una tienda en línea de México.
Responde SOLO con un objeto JSON, sin texto extra ni bloques de código, con estas claves:
{
  "title": nombre del producto o null,
  "price": precio FINAL que paga el comprador hoy, como número en pesos mexicanos (ej. 1499.9), o null si no se ve,
  "list_price": precio anterior tachado como número, o null si no hay,
  "in_stock": true si se puede comprar, false si dice agotado o no disponible,
  "confidence": número de 0 a 1 que indica qué tan seguro estás del precio
}
Reglas: ignora precios de productos patrocinados o relacionados, pagos "desde $X al mes" o "meses sin intereses", y precios de otros vendedores. Usa el precio principal del producto de la página.`;

const visionSchema = z.object({
	title: z.string().nullable().optional(),
	price: z.number().nullable(),
	list_price: z.number().nullable().optional(),
	in_stock: z.boolean(),
	confidence: z.number().min(0).max(1).nullable().optional(),
});

export type VisionResult = ScrapeResult & { confidence: number | null };

/**
 * Convierte la respuesta del modelo en datos. Función pura y probada: los
 * modelos a veces envuelven el JSON en ```json o agregan texto alrededor.
 */
export function parseVisionResponse(text: string): VisionResult {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start === -1 || end <= start) {
		throw new ExtractionError("El modelo no devolvió un JSON");
	}

	let raw: unknown;
	try {
		raw = JSON.parse(text.slice(start, end + 1));
	} catch {
		throw new ExtractionError("El modelo devolvió un JSON inválido");
	}
	const parsed = visionSchema.safeParse(raw);
	if (!parsed.success) {
		throw new ExtractionError(
			"El JSON del modelo no tiene el formato esperado",
		);
	}

	const { title, price, list_price, in_stock, confidence } = parsed.data;
	const priceCents = toCents(price);
	const listCents = toCents(list_price);
	const inStock = in_stock && priceCents != null;
	return {
		title: title ?? null,
		imageUrl: null,
		price: inStock ? priceCents : null,
		listPrice:
			inStock &&
			listCents != null &&
			priceCents != null &&
			listCents > priceCents
				? listCents
				: null,
		inStock,
		sellerId: null,
		sellerName: null,
		source: "vision",
		confidence: confidence ?? null,
	};
}

export async function extractPriceFromImage(
	png: Buffer,
	model = process.env.OPENROUTER_MODEL || DEFAULT_VISION_MODEL,
): Promise<VisionResult> {
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		throw new NotConfiguredError("Falta OPENROUTER_API_KEY en .env.local");
	}

	const response = await fetch(ENDPOINT, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			temperature: 0,
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: PROMPT },
						{
							type: "image_url",
							image_url: {
								url: `data:image/png;base64,${png.toString("base64")}`,
							},
						},
					],
				},
			],
		}),
		// Los modelos gratuitos a veces tardan bastante en cola
		signal: AbortSignal.timeout(90_000),
	});

	if (!response.ok) {
		const detail = (await response.text()).slice(0, 300);
		throw new ExtractionError(`OpenRouter ${response.status}: ${detail}`);
	}
	const data = (await response.json()) as {
		choices?: { message?: { content?: string } }[];
		error?: { message?: string };
	};
	const content = data.choices?.[0]?.message?.content;
	if (!content) {
		throw new ExtractionError(
			`OpenRouter no devolvió respuesta: ${data.error?.message ?? "vacía"}`,
		);
	}
	return parseVisionResponse(content);
}
