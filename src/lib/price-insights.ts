/**
 * Interpretación del precio tachado ("antes $X") contra NUESTRO historial.
 * Funciones puras: sin base de datos ni React, fáciles de probar.
 */

export type HistoryPoint = {
	price: number | null;
	isSuspicious: boolean;
	checkedAt: Date;
};

/** Porcentaje de descuento (entero), o null si no hay un "antes" mayor al precio */
export function discountPercent(
	price: number | null | undefined,
	listPrice: number | null | undefined,
) {
	if (price == null || listPrice == null || listPrice <= price) return null;
	return Math.round(((listPrice - price) / listPrice) * 100);
}

export type OfferVerdict =
	/** La tienda no marca descuento */
	| { kind: "none" }
	/** Hay descuento, pero llevamos poco tiempo siguiendo el producto */
	| { kind: "too_early" }
	/** Hace poco costaba casi lo que dice el "antes": la oferta es creíble */
	| { kind: "confirmed"; highestSeen: number }
	/** Nunca lo vimos cerca del "antes": no podemos comprobar ese descuento */
	| { kind: "unverified"; highestSeen: number; days: number };

/** Con menos historial que esto no opinamos */
const MIN_POINTS = 3;
const MIN_DAYS = 3;
/** El "antes" cuenta como visto si el precio llegó a estar a menos de 10% de él */
const NEAR_LIST_TOLERANCE = 0.9;
const DAY_MS = 86_400_000;

/**
 * ¿Es creíble el descuento que marca la tienda? Solo podemos comprobarlo con
 * lo que NOSOTROS vimos desde que seguimos el producto: por eso el resultado
 * "unverified" no significa "falso", sino "no lo hemos visto a ese precio".
 */
export function judgeOffer(
	price: number | null,
	listPrice: number | null,
	history: HistoryPoint[],
): OfferVerdict {
	if (discountPercent(price, listPrice) == null || listPrice == null) {
		return { kind: "none" };
	}

	const valid = history.filter(
		(point): point is HistoryPoint & { price: number } =>
			point.price != null && !point.isSuspicious,
	);
	if (valid.length < MIN_POINTS) return { kind: "too_early" };

	const times = valid.map((point) => point.checkedAt.getTime());
	const days = (Math.max(...times) - Math.min(...times)) / DAY_MS;
	if (days < MIN_DAYS) return { kind: "too_early" };

	const highestSeen = Math.max(...valid.map((point) => point.price));
	return highestSeen >= listPrice * NEAR_LIST_TOLERANCE
		? { kind: "confirmed", highestSeen }
		: { kind: "unverified", highestSeen, days: Math.floor(days) };
}
