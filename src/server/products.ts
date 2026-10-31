import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { checkAndNotify } from "#/services/alerts";
import * as productService from "#/services/products";

/*
 * Server functions: el "puente" entre la UI y la lógica en src/services.
 * - El handler corre SOLO en el servidor. En el bundle del cliente se
 *   reemplaza por una llamada HTTP (RPC) que TanStack Start genera solo.
 * - `.validator()` valida la entrada EN EL SERVIDOR: nunca confíes en lo que
 *   manda el navegador, aunque el formulario ya lo valide.
 */

const productIdInput = z.object({ id: z.number().int().positive() });

export const listProducts = createServerFn({ method: "GET" }).handler(() =>
	productService.listProducts(),
);

export const getProduct = createServerFn({ method: "GET" })
	.validator(productIdInput)
	.handler(async ({ data }) => {
		const product = await productService.getProductWithHistory(data.id);
		// notFound() hace que el router muestre el notFoundComponent de la ruta
		if (!product) throw notFound();
		return product;
	});

export const addProduct = createServerFn({ method: "POST" })
	.validator(z.object({ url: z.string().trim().min(1, "Pega un link") }))
	.handler(async ({ data }) => {
		const result = await productService.addProductFromUrl(data.url);
		// Primera revisión inmediata: así ves título y precio de una vez.
		// Si falla no pasa nada, el producto ya quedó guardado.
		if (result.status === "created") await checkAndNotify(result.id);
		return result;
	});

export const checkProductNow = createServerFn({ method: "POST" })
	.validator(productIdInput)
	.handler(({ data }) => checkAndNotify(data.id));

export const setProductPaused = createServerFn({ method: "POST" })
	.validator(productIdInput.extend({ paused: z.boolean() }))
	.handler(({ data }) => productService.setProductPaused(data.id, data.paused));

export const deleteProduct = createServerFn({ method: "POST" })
	.validator(productIdInput)
	.handler(({ data }) => productService.deleteProduct(data.id));
