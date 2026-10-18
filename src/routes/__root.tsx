import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { SiteHeader } from "#/components/site-header";
import { themeInitScript } from "#/lib/theme";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Tracker Price" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
		// Se ejecuta antes de pintar para aplicar el tema guardado sin parpadeo
		scripts: [{ children: themeInitScript }],
	}),
	shellComponent: RootDocument,
});

/**
 * El "shell" es el documento HTML completo. Las rutas hijas se renderizan
 * dentro de `children`.
 */
function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		// suppressHydrationWarning: el script de tema cambia la clase de <html>
		// antes de que React hidrate, y eso es intencional
		<html lang="es" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen">
				<SiteHeader />
				<main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
				<TanStackDevtools
					config={{ position: "bottom-right" }}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
