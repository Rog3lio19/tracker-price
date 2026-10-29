/**
 * Alertas: después de cada revisión, decide si hay algo que avisarte y lo manda
 * por Telegram. La decisión (`evaluateRules`) es una función pura y probada;
 * el resto es pegamento con la base de datos y con Telegram.
 */
import { eq, notExists } from "drizzle-orm";

import { db } from "#/db";
import {
	type AlertRule,
	alertRules,
	notifications,
	type Product,
	products,
} from "#/db/schema";
import { formatPrice } from "#/lib/format";
import { escapeHtml, sendToOwner } from "#/telegram/api";

import { type CheckOutcome, checkProduct } from "./checks";

/** Reglas que recibe todo producto nuevo; el precio objetivo se agrega con /objetivo */
const DEFAULT_RULES = [
	{ type: "all_time_low", threshold: null },
	{ type: "percent_drop", threshold: 10 },
	{ type: "back_in_stock", threshold: null },
] as const;

export function createDefaultRules(productId: number) {
	db.insert(alertRules)
		.values(DEFAULT_RULES.map((rule) => ({ ...rule, productId })))
		.run();
}

/** Productos que ya existían antes de las alertas y no tienen ninguna regla */
export function ensureDefaultRules() {
	const orphans = db
		.select({ id: products.id })
		.from(products)
		.where(
			notExists(
				db
					.select({ id: alertRules.id })
					.from(alertRules)
					.where(eq(alertRules.productId, products.id)),
			),
		)
		.all();
	for (const { id } of orphans) createDefaultRules(id);
}

type OkOutcome = Extract<CheckOutcome, { kind: "ok" }>;

const REASON_LABELS: Record<AlertRule["type"], (rule: AlertRule) => string> = {
	target_price: (rule) =>
		`llegó a tu precio objetivo (${formatPrice(rule.threshold)})`,
	percent_drop: (rule) => `bajó ${rule.threshold}% o más`,
	all_time_low: () => "nuevo mínimo histórico",
	back_in_stock: () => "volvió a tener stock",
};

/**
 * ¿Qué reglas se cumplen con esta revisión? Función pura.
 * - Cambios sospechosos (>50%) nunca avisan hasta confirmarse.
 * - La primera revisión de un producto no avisa (no hay con qué comparar).
 * - Cada regla respeta su "cooldown" para no repetirte lo mismo,
 *   salvo `all_time_low`: un mínimo nuevo siempre es noticia.
 */
export function evaluateRules(
	rules: AlertRule[],
	outcome: OkOutcome,
	now = new Date(),
) {
	const { price, inStock, suspicious, previous } = outcome;
	if (suspicious || !inStock || price == null) return [];

	return rules.filter((rule) => {
		if (!rule.isActive) return false;
		if (rule.type !== "all_time_low" && rule.lastTriggeredAt) {
			const cooldownEnd =
				rule.lastTriggeredAt.getTime() + rule.cooldownHours * 3_600_000;
			if (cooldownEnd > now.getTime()) return false;
		}

		switch (rule.type) {
			case "target_price":
				// Solo al CRUZAR el objetivo, no cada vez que sigue por debajo
				return (
					rule.threshold != null &&
					price <= rule.threshold &&
					(previous.price == null || previous.price > rule.threshold)
				);
			case "percent_drop":
				return (
					rule.threshold != null &&
					previous.price != null &&
					((previous.price - price) / previous.price) * 100 >= rule.threshold
				);
			case "all_time_low":
				return previous.lowestPrice != null && price < previous.lowestPrice;
			case "back_in_stock":
				return !previous.wasInStock;
			default:
				// Si se agrega un tipo nuevo a alertTypes, TypeScript marca esta línea
				return rule.type satisfies never;
		}
	});
}

export function buildAlertMessage(
	product: Product,
	outcome: OkOutcome,
	triggered: AlertRule[],
) {
	const title = escapeHtml(product.title ?? product.externalId ?? "Producto");
	const lines = [`📉 <b>${title}</b>`];

	const was =
		outcome.listPrice != null
			? ` (antes ${formatPrice(outcome.listPrice)} según la tienda)`
			: "";
	lines.push(`<b>${formatPrice(outcome.price)}</b>${was}`);
	if (outcome.previous.price != null) {
		lines.push(`Última revisión: ${formatPrice(outcome.previous.price)}`);
	}
	for (const rule of triggered)
		lines.push(`• ${REASON_LABELS[rule.type](rule)}`);
	if (product.sellerName)
		lines.push(`Vendedor: ${escapeHtml(product.sellerName)}`);
	lines.push(product.canonicalUrl);
	return lines.join("\n");
}

/**
 * Revisa un producto Y avisa si corresponde. Es lo que deben llamar el worker
 * y los botones de la web, en vez de `checkProduct` a secas.
 */
export async function checkAndNotify(productId: number) {
	const outcome = await checkProduct(productId);
	try {
		await notifyAfterCheck(productId, outcome);
	} catch (error) {
		// Un fallo de Telegram no debe tirar la revisión, que ya quedó guardada
		console.error("No se pudo mandar la alerta:", error);
	}
	return outcome;
}

async function notifyAfterCheck(productId: number, outcome: CheckOutcome) {
	const product = db
		.select()
		.from(products)
		.where(eq(products.id, productId))
		.get();
	if (!product) return;

	if (outcome.kind === "seller_changed") {
		const text = [
			`⚠️ <b>${escapeHtml(product.title ?? "Producto")}</b>`,
			`La publicación ahora es de <b>${escapeHtml(outcome.found)}</b> y no de ${escapeHtml(outcome.expected)}.`,
			"No registré ese precio y dejé de revisarlo. Pausa o elimínalo desde la web.",
			product.canonicalUrl,
		].join("\n");
		await sendToOwner(text);
		return;
	}

	if (outcome.kind !== "ok") return;

	const rules = db
		.select()
		.from(alertRules)
		.where(eq(alertRules.productId, productId))
		.all();
	const triggered = evaluateRules(rules, outcome);
	if (triggered.length === 0) return;

	const text = buildAlertMessage(product, outcome, triggered);
	const messageId = await sendToOwner(text);
	// Si no hay chat vinculado todavía, no marcamos nada: la alerta sigue pendiente
	if (messageId === null) return;

	db.transaction((tx) => {
		for (const rule of triggered) {
			tx.update(alertRules)
				.set({ lastTriggeredAt: new Date() })
				.where(eq(alertRules.id, rule.id))
				.run();
		}
		tx.insert(notifications)
			.values({
				productId,
				alertRuleId: triggered[0]?.id,
				message: text,
				telegramMessageId: messageId,
			})
			.run();
	});
}
