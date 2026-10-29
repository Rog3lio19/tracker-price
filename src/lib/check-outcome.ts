import type { CheckOutcome } from "#/services/checks";

import { formatPrice } from "./format";

/** Texto para el usuario (web y, más adelante, Telegram) */
export function describeCheckOutcome(outcome: CheckOutcome) {
	switch (outcome.kind) {
		case "ok":
			if (!outcome.inStock) return "Revisado: sin stock por ahora";
			return outcome.suspicious
				? `Revisado: ${formatPrice(outcome.price)} (cambio brusco, se marcó como sospechoso)`
				: `Revisado: ${formatPrice(outcome.price)}`;
		case "seller_changed":
			return `La publicación ahora es de "${outcome.found}" y no de "${outcome.expected}". No se registró el precio.`;
		case "blocked":
			return `La tienda está frenando las revisiones: ${outcome.message}`;
		case "error":
			return outcome.message;
	}
}
