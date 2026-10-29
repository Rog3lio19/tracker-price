/**
 * Planificador: decide QUÉ productos toca revisar y los revisa con calma.
 * Lo usa el worker (scripts/worker.ts); no depende de TanStack Start.
 */
import { inArray } from "drizzle-orm";

import { db } from "#/db";
import { type Product, products } from "#/db/schema";
import { checkAndNotify } from "#/services/alerts";

/** "error" y "paused" no se revisan solos: requieren que tú intervengas */
const CHECKABLE_STATUSES = ["active", "out_of_stock"] as const;

/** Si una tienda nos frena (CAPTCHA, 429), la dejamos descansar este rato */
export const BLOCK_COOLDOWN_MS = 60 * 60 * 1000;

/** Pausa entre revisiones: ~5 a 15 s, para no parecer una ráfaga de peticiones */
const MIN_GAP_MS = 5_000;
const MAX_GAP_MS = 15_000;

/** Función pura (fácil de probar): ¿ya le toca revisión a este producto? */
export function isDue(
	product: Pick<Product, "lastCheckedAt" | "checkIntervalMinutes">,
	now: Date,
) {
	if (!product.lastCheckedAt) return true;
	const dueAt =
		product.lastCheckedAt.getTime() + product.checkIntervalMinutes * 60_000;
	return dueAt <= now.getTime();
}

export function findDueProducts(now = new Date()) {
	return db
		.select()
		.from(products)
		.where(inArray(products.status, [...CHECKABLE_STATUSES]))
		.all()
		.filter((product) => isDue(product, now))
		.sort(
			(a, b) =>
				(a.lastCheckedAt?.getTime() ?? 0) - (b.lastCheckedAt?.getTime() ?? 0),
		);
}

/** Tiendas en descanso por bloqueo: marketplace -> hasta cuándo (ms epoch) */
const blockedUntil = new Map<Product["marketplace"], number>();

export type RunSummary = {
	checked: number;
	failed: number;
	skippedBlocked: number;
};

/**
 * Revisa todos los productos pendientes, de uno en uno.
 * `sleep` se inyecta para poder probarlo sin esperar de verdad.
 */
export async function runDueChecks(
	log: (message: string) => void = console.log,
	sleep: (ms: number) => Promise<void> = (ms) =>
		new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<RunSummary> {
	const summary: RunSummary = { checked: 0, failed: 0, skippedBlocked: 0 };
	const due = findDueProducts();
	if (due.length === 0) return summary;
	log(`${due.length} producto(s) por revisar`);

	for (const [index, product] of due.entries()) {
		const resumeAt = blockedUntil.get(product.marketplace) ?? 0;
		if (resumeAt > Date.now()) {
			summary.skippedBlocked++;
			continue;
		}

		const label = product.title ?? product.externalId ?? `#${product.id}`;
		const outcome = await checkAndNotify(product.id);
		summary.checked++;

		switch (outcome.kind) {
			case "ok":
				log(`✓ ${label}: ${outcome.price ?? "sin stock"}`);
				break;
			case "seller_changed":
				log(`⚠ ${label}: cambió de vendedor (${outcome.found})`);
				break;
			case "blocked":
				summary.failed++;
				blockedUntil.set(product.marketplace, Date.now() + BLOCK_COOLDOWN_MS);
				log(
					`⛔ ${product.marketplace} nos frenó (${outcome.message}). Descanso de 1 h.`,
				);
				break;
			case "error":
				summary.failed++;
				log(`✗ ${label}: ${outcome.message}`);
				break;
		}

		if (index < due.length - 1) {
			await sleep(MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS));
		}
	}
	return summary;
}
