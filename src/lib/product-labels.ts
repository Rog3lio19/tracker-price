import type { Marketplace, ProductStatus } from "#/db/schema";

export const marketplaceLabel: Record<Marketplace, string> = {
	amazon: "Amazon",
	mercadolibre: "Mercado Libre",
};

export const statusLabel: Record<ProductStatus, string> = {
	active: "Activo",
	paused: "Pausado",
	out_of_stock: "Sin stock",
	seller_changed: "Cambió de vendedor",
	error: "Error",
};

export const statusClassName: Record<ProductStatus, string> = {
	active: "border-success/40 text-success",
	paused: "text-muted-foreground",
	out_of_stock: "border-warning/40 text-warning",
	seller_changed: "border-warning/40 text-warning",
	error: "border-destructive/40 text-destructive",
};
