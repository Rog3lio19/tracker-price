import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
	buildAuthorizeUrl,
	connectWithCode,
	disconnectMercadoLibre,
	getMercadoLibreStatus,
} from "#/scraper/mercadolibre/oauth";

export const getMercadoLibreConnection = createServerFn({
	method: "GET",
}).handler(() => getMercadoLibreStatus());

export const startMercadoLibreConnect = createServerFn({
	method: "POST",
}).handler(async () => ({
	url: await buildAuthorizeUrl(),
}));

export const finishMercadoLibreConnect = createServerFn({ method: "POST" })
	.validator(z.object({ input: z.string().trim().min(1) }))
	.handler(async ({ data }) => {
		try {
			const userId = await connectWithCode(data.input);
			return { ok: true as const, userId };
		} catch (error) {
			return { ok: false as const, error: (error as Error).message };
		}
	});

export const disconnectMercadoLibreAccount = createServerFn({
	method: "POST",
}).handler(() => disconnectMercadoLibre());
