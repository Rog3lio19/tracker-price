/**
 * Un cambio brusco de precio (más de 50 %) puede ser una oferta real o un error
 * de lectura. Para distinguirlos pedimos CONFIRMACIÓN: si la revisión anterior
 * ya había visto casi el mismo precio raro, deja de ser sospechoso.
 */

/** Un cambio de más de 50% contra el último precio confirmado es sospechoso */
const SUSPICIOUS_CHANGE = 0.5;
/** Dos lecturas raras que difieren menos de esto cuentan como la misma */
const CONFIRM_TOLERANCE = 0.05;

export function isSuspiciousChange(
	price: number | null,
	lastConfirmedPrice: number | null,
	/** Última lectura guardada, si fue marcada como sospechosa */
	lastSuspiciousPrice: number | null,
) {
	if (price == null || lastConfirmedPrice == null) return false;
	const jump = Math.abs(price - lastConfirmedPrice) / lastConfirmedPrice;
	if (jump <= SUSPICIOUS_CHANGE) return false;

	const confirmed =
		lastSuspiciousPrice != null &&
		Math.abs(price - lastSuspiciousPrice) / lastSuspiciousPrice <=
			CONFIRM_TOLERANCE;
	return !confirmed;
}
