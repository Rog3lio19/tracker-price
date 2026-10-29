import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageSearch } from "lucide-react";

import { AddProductForm } from "#/components/add-product-form";
import { Badge } from "#/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { formatPrice } from "#/lib/format";
import { discountPercent } from "#/lib/price-insights";
import {
	marketplaceLabel,
	statusClassName,
	statusLabel,
} from "#/lib/product-labels";
import { listProducts } from "#/server/products";

export const Route = createFileRoute("/")({
	// El loader corre antes de renderizar la ruta (en el servidor en la primera
	// carga, y en el cliente al navegar). Su resultado llega tipado al componente.
	loader: () => listProducts(),
	component: ProductsPage,
});

type ListedProduct = Awaited<ReturnType<typeof listProducts>>[number];

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

			{products.length > 0 && <Summary products={products} />}

			<AddProductForm />

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

/** Tres números para ver de un vistazo cómo va todo */
function Summary({ products }: { products: ListedProduct[] }) {
	const onSale = products.filter(
		(p) =>
			p.status === "active" &&
			discountPercent(p.lastPrice, p.listPrice) != null,
	).length;
	const needAttention = products.filter(
		(p) =>
			p.status === "error" ||
			p.status === "seller_changed" ||
			p.status === "out_of_stock",
	).length;

	return (
		<div className="grid gap-4 sm:grid-cols-3">
			<SummaryStat label="Siguiendo" value={products.length} />
			<SummaryStat
				label="Con descuento en la tienda"
				value={onSale}
				className={onSale > 0 ? "text-success" : undefined}
			/>
			<SummaryStat
				label="Requieren atención"
				value={needAttention}
				className={needAttention > 0 ? "text-warning" : undefined}
			/>
		</div>
	);
}

function SummaryStat({
	label,
	value,
	className,
}: {
	label: string;
	value: number;
	className?: string;
}) {
	return (
		<Card className="gap-1 py-4">
			<CardContent className="px-4">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p
					className={`font-mono text-2xl font-semibold tabular-nums ${className ?? ""}`}
				>
					{value}
				</p>
			</CardContent>
		</Card>
	);
}

function EmptyState() {
	return (
		<Card className="border-dashed">
			<CardContent className="flex flex-col items-center gap-3 py-12 text-center">
				<PackageSearch className="size-10 text-tn-magenta" />
				<p className="font-medium">Aún no sigues ningún producto</p>
				<p className="max-w-sm text-sm text-muted-foreground">
					Pega arriba el link de un producto para empezar a seguir su precio.
				</p>
			</CardContent>
		</Card>
	);
}

function ProductCard({ product }: { product: ListedProduct }) {
	const discount = discountPercent(product.lastPrice, product.listPrice);
	return (
		<Link
			to="/products/$productId"
			params={{ productId: String(product.id) }}
			className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<Card className="h-full transition-colors group-hover:border-primary/50">
				<CardHeader>
					<div className="flex items-center gap-2">
						<Badge variant="secondary">
							{marketplaceLabel[product.marketplace]}
						</Badge>
						{product.status !== "active" && (
							<Badge
								variant="outline"
								className={statusClassName[product.status]}
							>
								{statusLabel[product.status]}
							</Badge>
						)}
					</div>
					<CardTitle className="line-clamp-2 text-base break-all">
						{product.title ?? product.externalId ?? product.canonicalUrl}
					</CardTitle>
					{product.sellerName && (
						<CardDescription>Vendedor: {product.sellerName}</CardDescription>
					)}
				</CardHeader>
				<CardContent className="mt-auto space-y-1">
					<div className="flex items-baseline justify-between">
						<span className="font-mono text-2xl font-semibold tabular-nums">
							{formatPrice(product.lastPrice)}
						</span>
						{product.lowestPrice != null && (
							<span className="text-xs text-success">
								mín. {formatPrice(product.lowestPrice)}
							</span>
						)}
					</div>
					{discount != null && (
						<p className="flex items-center gap-2 text-xs">
							<span className="text-muted-foreground line-through">
								{formatPrice(product.listPrice)}
							</span>
							<span className="text-success">−{discount}%</span>
						</p>
					)}
				</CardContent>
			</Card>
		</Link>
	);
}
