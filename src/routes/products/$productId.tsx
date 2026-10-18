import {
	createFileRoute,
	Link,
	notFound,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import {
	ArrowLeft,
	ExternalLink,
	History,
	Loader2,
	Pause,
	Play,
	ShieldCheck,
	Trash2,
} from "lucide-react";
import { useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "#/components/ui/alert-dialog";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { formatDateTime, formatPrice } from "#/lib/format";
import {
	marketplaceLabel,
	statusClassName,
	statusLabel,
} from "#/lib/product-labels";
import { cn } from "#/lib/utils";
import { deleteProduct, getProduct, setProductPaused } from "#/server/products";

/*
 * El archivo se llama `$productId.tsx`: el `$` convierte ese segmento en un
 * parámetro dinámico. /products/7 -> params.productId === '7' (siempre string).
 */
export const Route = createFileRoute("/products/$productId")({
	loader: ({ params }) => {
		const id = Number(params.productId);
		if (!Number.isInteger(id) || id <= 0) throw notFound();
		return getProduct({ data: { id } });
	},
	head: ({ loaderData }) => ({
		meta: [{ title: `${loaderData?.title ?? "Producto"} · Tracker Price` }],
	}),
	component: ProductPage,
	notFoundComponent: ProductNotFound,
});

function ProductPage() {
	const product = Route.useLoaderData();
	const isPaused = product.status === "paused";

	return (
		<div className="space-y-6">
			<Link
				to="/"
				className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft className="size-4" />
				Productos
			</Link>

			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="secondary">
							{marketplaceLabel[product.marketplace]}
						</Badge>
						<Badge
							variant="outline"
							className={statusClassName[product.status]}
						>
							{statusLabel[product.status]}
						</Badge>
					</div>
					<h1 className="text-2xl font-semibold tracking-tight break-all">
						{product.title ?? product.externalId ?? "Producto sin nombre"}
					</h1>
					<a
						href={product.canonicalUrl}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
					>
						Ver en {marketplaceLabel[product.marketplace]}
						<ExternalLink className="size-3.5" />
					</a>
				</div>

				<div className="flex shrink-0 gap-2">
					<PauseButton id={product.id} isPaused={isPaused} />
					<DeleteButton id={product.id} />
				</div>
			</div>

			<div className="grid gap-4 sm:grid-cols-3">
				<Stat label="Precio actual" value={formatPrice(product.lastPrice)} />
				<Stat
					label="Mínimo histórico"
					value={formatPrice(product.lowestPrice)}
					className="text-success"
				/>
				<Stat
					label="Última revisión"
					value={formatDateTime(product.lastCheckedAt)}
					small
				/>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<ShieldCheck className="size-4 text-tn-teal" />
						Detalles
					</CardTitle>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
						<Detail
							label={product.marketplace === "amazon" ? "ASIN" : "Publicación"}
							value={product.externalId}
						/>
						{product.marketplace === "mercadolibre" && (
							<>
								<Detail label="Catálogo" value={product.catalogProductId} />
								<Detail
									label="Vendedor"
									value={product.sellerName ?? product.sellerId}
									fallback="Se detectará en la primera revisión"
								/>
								<Detail
									label="Solo este vendedor"
									value={product.sellerLock ? "Sí" : "No"}
								/>
							</>
						)}
						<Detail
							label="Revisar cada"
							value={formatInterval(product.checkIntervalMinutes)}
						/>
						<Detail
							label="Agregado"
							value={formatDateTime(product.createdAt)}
						/>
					</dl>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<History className="size-4 text-tn-blue" />
						Historial de precios
					</CardTitle>
					<CardDescription>
						Últimas {product.snapshots.length} revisiones
					</CardDescription>
				</CardHeader>
				<CardContent>
					{product.snapshots.length === 0 ? (
						<p className="py-6 text-center text-sm text-muted-foreground">
							Todavía no hay revisiones de este producto.
						</p>
					) : (
						<ul className="divide-y">
							{product.snapshots.map((snapshot) => (
								<li
									key={snapshot.id}
									className="flex items-center justify-between py-2 text-sm"
								>
									<span className="text-muted-foreground">
										{formatDateTime(snapshot.checkedAt)}
									</span>
									<span className="font-mono tabular-nums">
										{snapshot.inStock
											? formatPrice(snapshot.price)
											: "Sin stock"}
									</span>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function PauseButton({ id, isPaused }: { id: number; isPaused: boolean }) {
	const router = useRouter();
	const [pending, setPending] = useState(false);

	async function toggle() {
		setPending(true);
		try {
			await setProductPaused({ data: { id, paused: !isPaused } });
			// Vuelve a correr los loaders activos: la página se actualiza sola
			await router.invalidate();
		} finally {
			setPending(false);
		}
	}

	return (
		<Button variant="outline" onClick={toggle} disabled={pending}>
			{pending ? (
				<Loader2 className="animate-spin" />
			) : isPaused ? (
				<Play />
			) : (
				<Pause />
			)}
			{isPaused ? "Reanudar" : "Pausar"}
		</Button>
	);
}

function DeleteButton({ id }: { id: number }) {
	const router = useRouter();
	const navigate = useNavigate();

	async function onConfirm() {
		await deleteProduct({ data: { id } });
		await router.invalidate();
		await navigate({ to: "/" });
	}

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="outline" className="text-destructive">
					<Trash2 />
					Eliminar
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>¿Eliminar este producto?</AlertDialogTitle>
					<AlertDialogDescription>
						Se borrará también todo su historial de precios y sus alertas. Esta
						acción no se puede deshacer.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancelar</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						Eliminar
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function Stat({
	label,
	value,
	className,
	small,
}: {
	label: string;
	value: string;
	className?: string;
	small?: boolean;
}) {
	return (
		<Card className="gap-1 py-4">
			<CardContent className="px-4">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p
					className={cn(
						"font-mono font-semibold tabular-nums",
						small ? "text-base" : "text-2xl",
						className,
					)}
				>
					{value}
				</p>
			</CardContent>
		</Card>
	);
}

function Detail({
	label,
	value,
	fallback = "—",
}: {
	label: string;
	value: string | null | undefined;
	fallback?: string;
}) {
	return (
		<div>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className={value ? "font-medium" : "text-muted-foreground italic"}>
				{value ?? fallback}
			</dd>
		</div>
	);
}

function formatInterval(minutes: number) {
	return minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
}

function ProductNotFound() {
	return (
		<div className="space-y-4 py-12 text-center">
			<p className="text-lg font-medium">Este producto no existe</p>
			<Button asChild variant="outline">
				<Link to="/">Volver a productos</Link>
			</Button>
		</div>
	);
}
