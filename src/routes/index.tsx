import { createFileRoute } from "@tanstack/react-router";
import { PackageSearch } from "lucide-react";

import { Badge } from "#/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import type { Product } from "#/db/schema";
import { formatPrice } from "#/lib/format";
import { listProducts } from "#/server/products";

export const Route = createFileRoute("/")({
	// El loader corre antes de renderizar la ruta (en el servidor en la primera
	// carga, y en el cliente al navegar). Su resultado llega tipado al componente.
	loader: () => listProducts(),
	component: ProductsPage,
});

function ProductsPage() {
	const products = Route.useLoaderData();

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
				<p className="text-sm text-muted-foreground">
					Lo que estás siguiendo en Amazon y Mercado Libre.
				</p>
			</div>

			{products.length === 0 ? (
				<EmptyState />
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{products.map((product) => (
						<ProductCard key={product.id} product={product} />
					))}
				</div>
			)}
		</div>
	);
}

function EmptyState() {
	return (
		<Card className="border-dashed">
			<CardContent className="flex flex-col items-center gap-3 py-12 text-center">
				<PackageSearch className="size-10 text-tn-magenta" />
				<p className="font-medium">Aún no sigues ningún producto</p>
				<p className="max-w-sm text-sm text-muted-foreground">
					Muy pronto podrás agregarlos pegando el link aquí o mandándolo por
					Telegram.
				</p>
			</CardContent>
		</Card>
	);
}

const marketplaceLabel: Record<Product["marketplace"], string> = {
	amazon: "Amazon",
	mercadolibre: "Mercado Libre",
};

function ProductCard({ product }: { product: Product }) {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Badge variant="secondary">
						{marketplaceLabel[product.marketplace]}
					</Badge>
					{product.status !== "active" && (
						<Badge variant="outline" className="text-warning">
							{product.status}
						</Badge>
					)}
				</div>
				<CardTitle className="line-clamp-2 text-base">
					{product.title ?? product.url}
				</CardTitle>
				{product.sellerName && (
					<CardDescription>Vendedor: {product.sellerName}</CardDescription>
				)}
			</CardHeader>
			<CardContent className="flex items-baseline justify-between">
				<span className="font-mono text-2xl font-semibold tabular-nums">
					{formatPrice(product.lastPrice)}
				</span>
				{product.lowestPrice != null && (
					<span className="text-xs text-success">
						mín. {formatPrice(product.lowestPrice)}
					</span>
				)}
			</CardContent>
		</Card>
	);
}
