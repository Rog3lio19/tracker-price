import { APP_TIMEZONE } from "./config";

const mxn = new Intl.NumberFormat("es-MX", {
	style: "currency",
	currency: "MXN",
});

/** Los precios viven en centavos en la DB: 149900 -> "$1,499.00" */
export function formatPrice(cents: number | null | undefined) {
	if (cents == null) return "—";
	return mxn.format(cents / 100);
}

const dateTime = new Intl.DateTimeFormat("es-MX", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: APP_TIMEZONE,
});

export function formatDateTime(date: Date | null | undefined) {
	return date ? dateTime.format(date) : "—";
}

const shortDate = new Intl.DateTimeFormat("es-MX", {
	day: "numeric",
	month: "short",
	timeZone: APP_TIMEZONE,
});

/** "29 oct": para los ejes de la gráfica */
export function formatShortDate(date: Date) {
	return shortDate.format(date);
}

/** Precio sin centavos, para etiquetas apretadas: 149900 -> "$1,499" */
export function formatPriceShort(cents: number) {
	return new Intl.NumberFormat("es-MX", {
		style: "currency",
		currency: "MXN",
		maximumFractionDigits: 0,
	}).format(cents / 100);
}
