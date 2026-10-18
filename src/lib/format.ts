const mxn = new Intl.NumberFormat("es-MX", {
	style: "currency",
	currency: "MXN",
});

/** Los precios viven en centavos en la DB: 149900 -> "$1,499.00" */
export function formatPrice(cents: number | null | undefined) {
	if (cents == null) return "—";
	return mxn.format(cents / 100);
}
