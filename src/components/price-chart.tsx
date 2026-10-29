import {
	formatDateTime,
	formatPrice,
	formatPriceShort,
	formatShortDate,
} from "#/lib/format";
import type { HistoryPoint } from "#/lib/price-insights";

/*
 * Gráfica de líneas en SVG puro. El truco de un SVG responsivo es el `viewBox`:
 * dibujamos en un lienzo fijo de 640x240 "unidades" y el navegador lo escala
 * al ancho real. Todo lo que hacemos es convertir (fecha, precio) -> (x, y).
 */
const W = 640;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 64 };
const GRID_LINES = 4;

/** Marcas del eje en números redondos (en centavos): $250, $300... no $267.43 */
function niceTicks(min: number, max: number) {
	const rough = (max - min) / 100 / GRID_LINES; // en pesos
	const magnitude = 10 ** Math.floor(Math.log10(rough));
	const step =
		([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= rough) ?? 10) *
		magnitude *
		100;
	const ticks: number[] = [];
	for (let t = Math.ceil(min / step) * step; t <= max; t += step) ticks.push(t);
	return ticks;
}

export function PriceChart({
	history,
	lowestPrice,
}: {
	history: HistoryPoint[];
	lowestPrice: number | null;
}) {
	// Sin stock (price null) no se dibuja; las lecturas sospechosas sí, huecas
	const points = history
		.filter((p): p is HistoryPoint & { price: number } => p.price != null)
		.map((p) => ({ ...p, t: p.checkedAt.getTime() }))
		.sort((a, b) => a.t - b.t);

	if (points.length < 2) {
		return (
			<p className="py-10 text-center text-sm text-muted-foreground">
				La gráfica aparece con la segunda revisión.
			</p>
		);
	}

	const prices = points.map((p) => p.price);
	const confirmed = points.filter((p) => !p.isSuspicious).map((p) => p.price);
	// El eje se ajusta a lo confirmado: una lectura rara no debe aplastar la línea
	const lo = Math.min(
		...confirmed,
		...(lowestPrice != null ? [lowestPrice] : []),
	);
	const hi = Math.max(...confirmed);
	const margin = Math.max((hi - lo) * 0.12, hi * 0.02);
	const yMin = Math.max(0, lo - margin);
	const yMax = hi + margin;

	const tMin = points[0].t;
	const tMax = points[points.length - 1].t;

	const x = (t: number) =>
		PAD.left + ((t - tMin) / (tMax - tMin || 1)) * (W - PAD.left - PAD.right);
	const y = (price: number) =>
		PAD.top +
		(1 - (Math.min(Math.max(price, yMin), yMax) - yMin) / (yMax - yMin)) *
			(H - PAD.top - PAD.bottom);

	// Una lectura rara fuera del eje no se dibuja recortada (engañaría): se avisa abajo
	const visiblePoints = points.filter(
		(p) => !p.isSuspicious || (p.price >= yMin && p.price <= yMax),
	);
	const hidden = points.length - visiblePoints.length;

	const line = points
		.filter((p) => !p.isSuspicious)
		.map(
			(p, i) =>
				`${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.price).toFixed(1)}`,
		)
		.join(" ");

	const gridPrices = niceTicks(yMin, yMax);
	const xLabels = [tMin, (tMin + tMax) / 2, tMax];

	return (
		<>
			<svg
				viewBox={`0 0 ${W} ${H}`}
				role="img"
				aria-label={`Historial de precios, de ${formatPrice(Math.min(...prices))} a ${formatPrice(Math.max(...prices))}`}
				className="h-auto w-full text-muted-foreground"
			>
				{gridPrices.map((price) => (
					<g key={price}>
						<line
							x1={PAD.left}
							x2={W - PAD.right}
							y1={y(price)}
							y2={y(price)}
							className="stroke-border"
						/>
						<text
							x={PAD.left - 8}
							y={y(price)}
							textAnchor="end"
							dominantBaseline="middle"
							className="fill-current text-[11px]"
						>
							{formatPriceShort(price)}
						</text>
					</g>
				))}

				{lowestPrice != null && (
					<line
						x1={PAD.left}
						x2={W - PAD.right}
						y1={y(lowestPrice)}
						y2={y(lowestPrice)}
						strokeDasharray="4 4"
						className="stroke-success"
					>
						<title>Mínimo histórico: {formatPrice(lowestPrice)}</title>
					</line>
				)}

				<path d={line} fill="none" strokeWidth={2} className="stroke-primary" />

				{visiblePoints.map((p) => (
					<circle
						key={p.t}
						cx={x(p.t)}
						cy={y(p.price)}
						r={p.isSuspicious ? 4 : 3}
						strokeWidth={2}
						className={
							p.isSuspicious
								? "fill-background stroke-warning"
								: "fill-primary stroke-primary"
						}
					>
						<title>
							{formatDateTime(p.checkedAt)} · {formatPrice(p.price)}
							{p.isSuspicious ? " (lectura sospechosa)" : ""}
						</title>
					</circle>
				))}

				{xLabels.map((t, i) => (
					<text
						key={t}
						x={x(t)}
						y={H - 8}
						textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
						className="fill-current text-[11px]"
					>
						{formatShortDate(new Date(t))}
					</text>
				))}
			</svg>
			{hidden > 0 && (
				<p className="mt-2 text-xs text-warning">
					{hidden === 1
						? "Una lectura sospechosa quedó fuera de la gráfica (precio muy distinto al normal)."
						: `${hidden} lecturas sospechosas quedaron fuera de la gráfica (precio muy distinto al normal).`}
				</p>
			)}
		</>
	);
}
