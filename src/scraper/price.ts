/**
 * Convierte un precio en texto a centavos.
 * Formato mexicano: "$1,499.00" | "1499" | "$ 9,409" | "608.96"
 */
export function parsePriceToCents(text: string | null | undefined) {
	if (!text) return null;
	const cleaned = text.replace(/[^\d.,]/g, "");
	if (!cleaned) return null;
	// La coma es separador de miles en es-MX: se descarta
	const value = Number(cleaned.replace(/,/g, ""));
	if (!Number.isFinite(value) || value <= 0) return null;
	return Math.round(value * 100);
}

export function toCents(value: number | null | undefined) {
	return value == null || value <= 0 ? null : Math.round(value * 100);
}
