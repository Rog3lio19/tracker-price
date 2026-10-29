import { createFileRoute } from "@tanstack/react-router";

import { connectWithCode } from "#/scraper/mercadolibre/oauth";

/*
 * Server route: un endpoint HTTP "crudo" (sin componente de React).
 * Solo se usa si ML_REDIRECT_URI apunta a esta app, ej.
 * https://tracker.tu-dominio.com/api/mercadolibre/callback
 * Si no tienes HTTPS en el homelab, usa la opción de pegar el link en /settings.
 */
export const Route = createFileRoute("/api/mercadolibre/callback")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				let result = "ok";
				try {
					await connectWithCode(request.url);
				} catch (error) {
					result = (error as Error).message;
				}
				const target = new URL("/settings", request.url);
				target.searchParams.set("ml", result);
				return Response.redirect(target, 302);
			},
		},
	},
});
