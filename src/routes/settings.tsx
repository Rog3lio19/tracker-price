import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	CheckCircle2,
	ExternalLink,
	Loader2,
	Plug,
	Settings,
	Unplug,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { z } from "zod";

import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	disconnectMercadoLibreAccount,
	finishMercadoLibreConnect,
	getMercadoLibreConnection,
	startMercadoLibreConnect,
} from "#/server/settings";

/*
 * validateSearch: los "search params" (?ml=ok) también se validan, igual que
 * los datos de una server function. Así `Route.useSearch()` queda tipado.
 * Lo usa /api/mercadolibre/callback para avisarnos cómo terminó la conexión.
 */
export const Route = createFileRoute("/settings")({
	validateSearch: z.object({ ml: z.string().optional() }),
	loader: () => getMercadoLibreConnection(),
	head: () => ({ meta: [{ title: "Configuración · Tracker Price" }] }),
	component: SettingsPage,
});

function SettingsPage() {
	return (
		<div className="space-y-6">
			<h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
				<Settings className="size-6 text-muted-foreground" />
				Configuración
			</h1>
			<MercadoLibreCard />
		</div>
	);
}

function MercadoLibreCard() {
	const status = Route.useLoaderData();
	const { ml } = Route.useSearch();

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					Mercado Libre
					{status.connected ? (
						<Badge variant="outline" className="text-success">
							Conectado
						</Badge>
					) : (
						<Badge variant="outline" className="text-warning">
							Sin conectar
						</Badge>
					)}
				</CardTitle>
				<CardDescription>
					Usamos la API oficial: da el precio con promociones, el vendedor y el
					stock de cada publicación, sin CAPTCHAs.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4 text-sm">
				{ml && ml !== "ok" && <p className="text-destructive">{ml}</p>}

				{!status.appConfigured ? (
					<SetupInstructions />
				) : status.connected ? (
					<Connected userId={status.userId} />
				) : (
					<ConnectFlow redirectUri={status.redirectUri} />
				)}
			</CardContent>
		</Card>
	);
}

/** Paso 0: todavía no hay app registrada en el DevCenter */
function SetupInstructions() {
	return (
		<ol className="list-decimal space-y-2 pl-5">
			<li>
				Entra a{" "}
				<a
					href="https://developers.mercadolibre.com.mx/devcenter"
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center gap-1 text-primary hover:underline"
				>
					developers.mercadolibre.com.mx/devcenter
					<ExternalLink className="size-3.5" />
				</a>{" "}
				con tu cuenta y crea una aplicación.
			</li>
			<li>
				En <em>URI de redirect</em> pon{" "}
				<code className="rounded bg-muted px-1">https://www.google.com/</code>{" "}
				(ML exige HTTPS; solo la usaremos para copiar el código).
			</li>
			<li>
				Copia el <em>App ID</em> y la <em>Clave secreta</em> a{" "}
				<code className="rounded bg-muted px-1">.env.local</code> como{" "}
				<code className="rounded bg-muted px-1">ML_CLIENT_ID</code>,{" "}
				<code className="rounded bg-muted px-1">ML_CLIENT_SECRET</code> y{" "}
				<code className="rounded bg-muted px-1">ML_REDIRECT_URI</code>.
			</li>
			<li>Reinicia el servidor y vuelve a esta página.</li>
		</ol>
	);
}

/** Paso 1 y 2: autorizar en ML y pegar el link al que nos regresó */
function ConnectFlow({ redirectUri }: { redirectUri: string | null }) {
	const router = useRouter();
	const [input, setInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function openAuthorize() {
		const { url } = await startMercadoLibreConnect();
		window.open(url, "_blank", "noopener");
	}

	async function onSubmit(event: FormEvent) {
		event.preventDefault();
		setPending(true);
		setError(null);
		try {
			const result = await finishMercadoLibreConnect({ data: { input } });
			if (!result.ok) {
				setError(result.error);
				return;
			}
			setInput("");
			await router.invalidate();
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<p>
					<span className="font-medium">1.</span> Autoriza la app con tu cuenta
					de Mercado Libre (se abre en otra pestaña).
				</p>
				<Button onClick={openAuthorize}>
					<Plug />
					Conectar con Mercado Libre
				</Button>
			</div>

			<form onSubmit={onSubmit} className="space-y-2">
				<Label htmlFor="ml-code">
					<span className="font-medium">2.</span> Al terminar te manda a{" "}
					{redirectUri ?? "tu URI de redirect"}. Copia la URL completa de esa
					pestaña (trae <code>?code=TG-…</code>) y pégala aquí:
				</Label>
				<div className="flex gap-2">
					<Input
						id="ml-code"
						value={input}
						onChange={(event) => setInput(event.target.value)}
						placeholder="https://www.google.com/?code=TG-...&state=..."
					/>
					<Button type="submit" disabled={pending || !input.trim()}>
						{pending && <Loader2 className="animate-spin" />}
						Guardar
					</Button>
				</div>
				{error && <p className="text-destructive">{error}</p>}
				<p className="text-xs text-muted-foreground">
					El código dura solo unos minutos; si expira, vuelve al paso 1.
				</p>
			</form>
		</div>
	);
}

function Connected({ userId }: { userId: number | null }) {
	const router = useRouter();
	const [pending, setPending] = useState(false);

	async function disconnect() {
		setPending(true);
		try {
			await disconnectMercadoLibreAccount();
			await router.invalidate();
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<p className="flex items-center gap-2">
				<CheckCircle2 className="size-4 text-success" />
				Cuenta conectada (usuario {userId}). El token se renueva solo.
			</p>
			<Button variant="outline" onClick={disconnect} disabled={pending}>
				{pending ? <Loader2 className="animate-spin" /> : <Unplug />}
				Desconectar
			</Button>
		</div>
	);
}
